// Isolated test-only Supabase-compatible HTTP harness backed by in-memory PGlite.
// Used ONLY by Playwright E2E tests on 127.0.0.1:54329.
// Boots with ZERO users, ZERO groups, and ZERO products.
import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..', '..');
const PORT = Number(process.env.PGLITE_SUPABASE_PORT || 54329);
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'sb_secret_local_e2e_service_role_key';

const ALLOWED_TABLES = new Set([
  'categories',
  'profiles',
  'seller_groups',
  'group_members',
  'listings',
  'listing_images',
  'purchase_requests',
  'saved_listings',
  'reports',
  'moderation_events',
  'rate_limit_events',
]);

const IDENT_RE = /^[a-z_][a-z0-9_]*$/;

// In-memory Auth & Storage state (starts completely empty)
const usersById = new Map();
const userIdByEmail = new Map();
const authCodes = new Map();
const refreshTokens = new Map();
const storageBlobs = new Map(); // key: `${bucket}/${objectPath}` -> { bytes: Buffer, contentType: string }
const signedUrlTokens = new Map(); // token -> { key: string, expiresAt: number }

let db;
const rpcCatalog = new Map();
let txChain = Promise.resolve();

function enqueueDb(work) {
  const next = txChain.then(work, work);
  txChain = next.catch(() => {});
  return next;
}

function base64Url(input) {
  return Buffer.from(input).toString('base64url');
}

function makeJwt(user) {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + 3600;
  const header = base64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = base64Url(
    JSON.stringify({
      aud: 'authenticated',
      exp,
      iat: now,
      sub: user.id,
      email: user.email,
      role: 'authenticated',
      user_metadata: user.user_metadata || {},
      app_metadata: { provider: 'email', providers: ['email'] },
    })
  );
  const sig = base64Url(crypto.createHmac('sha256', 'local-e2e-jwt-secret').update(`${header}.${payload}`).digest());
  return { access_token: `${header}.${payload}.${sig}`, expires_in: 3600, expires_at: exp };
}

function formatAuthUser(user) {
  return {
    id: user.id,
    aud: 'authenticated',
    role: 'authenticated',
    email: user.email,
    email_confirmed_at: user.email_confirmed_at,
    phone: '',
    confirmed_at: user.email_confirmed_at,
    last_sign_in_at: new Date().toISOString(),
    app_metadata: { provider: 'email', providers: ['email'] },
    user_metadata: user.user_metadata || {},
    identities: [],
    created_at: user.created_at,
    updated_at: user.updated_at,
  };
}

function parseCaller(req) {
  const apiKey = req.headers['apikey'] || '';
  const authHeader = req.headers['authorization'] || '';
  const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';

  if (bearer === SERVICE_KEY || apiKey === SERVICE_KEY) {
    return { role: 'service_role', userId: null, user: null };
  }
  if (bearer && bearer.split('.').length === 3) {
    try {
      const payload = JSON.parse(Buffer.from(bearer.split('.')[1], 'base64url').toString('utf8'));
      if (payload.sub && usersById.has(payload.sub) && (!payload.exp || payload.exp * 1000 > Date.now())) {
        const user = usersById.get(payload.sub);
        if (!user.invalidatedTokens?.has(bearer)) {
          return { role: 'authenticated', userId: user.id, user, token: bearer };
        }
      }
    } catch {
      /* invalid token */
    }
  }
  return { role: 'anon', userId: null, user: null };
}

async function runWithRole(caller, callback) {
  return enqueueDb(async () => {
    await db.exec('begin');
    try {
      await db.exec(`set local role ${caller.role}`);
      await db.query(`select set_config('request.jwt.claim.sub', $1, true)`, [caller.userId || '']);
      const out = await callback(db);
      await db.exec('commit');
      return out;
    } catch (err) {
      await db.exec('rollback');
      throw err;
    }
  });
}

async function readRawBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks);
}

async function readJsonBody(req) {
  const raw = await readRawBody(req);
  if (!raw.length) return {};
  return JSON.parse(raw.toString('utf8'));
}

function sendJson(res, status, data, extraHeaders = {}) {
  const body = status === 204 ? '' : JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    'Access-Control-Expose-Headers': 'Content-Range',
    ...extraHeaders,
  });
  res.end(body);
}

function splitTopLevelCommas(input) {
  const parts = [];
  let current = '';
  let depth = 0;
  let inQuotes = false;
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (ch === '"' && input[i - 1] !== '\\') inQuotes = !inQuotes;
    else if (!inQuotes) {
      if (ch === '(') depth++;
      else if (ch === ')') depth = Math.max(0, depth - 1);
      else if (ch === ',' && depth === 0) {
        if (current.trim()) parts.push(current.trim());
        current = '';
        continue;
      }
    }
    current += ch;
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

function unquotePostgrestValue(val) {
  if (val.startsWith('"') && val.endsWith('"')) {
    return val.slice(1, -1).replace(/\\"/g, '"');
  }
  return val;
}

function buildCondition(col, expr, params, tableAlias = 't') {
  if (!IDENT_RE.test(col)) throw new Error(`Invalid column identifier: ${col}`);
  const colRef = `${tableAlias}."${col}"`;

  if (expr.startsWith('eq.')) {
    const val = unquotePostgrestValue(expr.slice(3));
    if (val === 'null') return `${colRef} is null`;
    params.push(val);
    return `${colRef} = $${params.length}`;
  }
  if (expr.startsWith('gte.')) {
    params.push(unquotePostgrestValue(expr.slice(4)));
    return `${colRef} >= $${params.length}`;
  }
  if (expr.startsWith('lte.')) {
    params.push(unquotePostgrestValue(expr.slice(4)));
    return `${colRef} <= $${params.length}`;
  }
  if (expr.startsWith('ilike.')) {
    let pattern = unquotePostgrestValue(expr.slice(6));
    if (pattern.startsWith('*') || pattern.endsWith('*')) {
      pattern = pattern.replace(/^\*/, '%').replace(/\*$/, '%');
    }
    params.push(pattern);
    return `coalesce(${colRef}::text, '') ilike $${params.length}`;
  }
  if (expr.startsWith('in.(') && expr.endsWith(')')) {
    const inner = expr.slice(4, -1);
    const items = splitTopLevelCommas(inner).map(unquotePostgrestValue);
    if (!items.length) return 'false';
    const placeholders = items.map((item) => {
      params.push(item);
      return `$${params.length}`;
    });
    return `${colRef} in (${placeholders.join(', ')})`;
  }
  throw new Error(`Unsupported PostgREST filter: ${col}=${expr}`);
}

function buildWhere(searchParams, params, tableAlias = 't') {
  const clauses = [];
  for (const [key, value] of searchParams.entries()) {
    if (['select', 'order', 'limit', 'offset', 'on_conflict', 'columns'].includes(key)) continue;
    if (key === 'or') {
      const inner = value.startsWith('(') && value.endsWith(')') ? value.slice(1, -1) : value;
      const subParts = splitTopLevelCommas(inner);
      const orSql = subParts.map((part) => {
        const dot = part.indexOf('.');
        if (dot <= 0) throw new Error(`Malformed or clause: ${part}`);
        const col = part.slice(0, dot);
        const rest = part.slice(dot + 1);
        return buildCondition(col, rest, params, tableAlias);
      });
      if (orSql.length) clauses.push(`(${orSql.join(' or ')})`);
    } else {
      clauses.push(buildCondition(key, value, params, tableAlias));
    }
  }
  return clauses.length ? `where ${clauses.join(' and ')}` : '';
}

function parseSelect(table, selectParam) {
  if (!selectParam || selectParam.trim() === '*') return 't.*';
  const tokens = splitTopLevelCommas(selectParam);
  const sqlCols = [];
  for (const token of tokens) {
    if (token === '*') {
      sqlCols.push('t.*');
      continue;
    }
    const relMatch = token.match(/^([a-z_][a-z0-9_]*)\(([^)]*)\)$/);
    if (relMatch) {
      const [, relTable, relColsRaw] = relMatch;
      if (table === 'listings' && relTable === 'listing_images') {
        const relCols = relColsRaw.trim();
        const innerSelect =
          relCols === '*'
            ? 'li.*'
            : splitTopLevelCommas(relCols)
                .map((c) => {
                  if (!IDENT_RE.test(c)) throw new Error(`Invalid nested col ${c}`);
                  return `li."${c}"`;
                })
                .join(', ');
        sqlCols.push(
          `coalesce((select json_agg(sub order by sub._ord asc) from (select ${innerSelect}, li.display_order as _ord from public.listing_images li where li.listing_id = t.id) sub), '[]'::json) as listing_images`
        );
        continue;
      }
      throw new Error(`Unsupported embedded relation ${relTable} on ${table}`);
    }
    if (!IDENT_RE.test(token)) throw new Error(`Invalid select column: ${token}`);
    sqlCols.push(`t."${token}"`);
  }
  return sqlCols.join(', ');
}

function cleanNestedRows(rows) {
  return rows.map((row) => {
    if (Array.isArray(row.listing_images)) {
      return {
        ...row,
        listing_images: row.listing_images.map(({ _ord, ...rest }) => {
          void _ord;
          return rest;
        }),
      };
    }
    return row;
  });
}

function parseOrder(orderParam, tableAlias = 't') {
  if (!orderParam) return '';
  const parts = [];
  for (const raw of orderParam.split(',')) {
    const segs = raw.trim().split('.');
    const col = segs[0];
    if (!IDENT_RE.test(col)) throw new Error(`Invalid order column: ${col}`);
    const dir = segs.includes('desc') ? 'desc' : 'asc';
    parts.push(`${tableAlias}."${col}" ${dir}`);
  }
  return parts.length ? `order by ${parts.join(', ')}` : '';
}

function pgErrorPayload(err) {
  return {
    message: err?.message || 'Database error',
    code: err?.code || '40000',
    details: err?.detail || null,
    hint: err?.hint || null,
  };
}

async function handleAuth(req, res, url) {
  const subPath = url.pathname.slice('/auth/v1'.length);

  if (req.method === 'POST' && subPath === '/signup') {
    const body = await readJsonBody(req);
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    const userMetadata = body.data || body.user_metadata || {};
    if (!email || !password) return sendJson(res, 400, { msg: 'Email and password required' });
    if (userIdByEmail.has(email)) return sendJson(res, 422, { msg: 'User already registered' });

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const user = {
      id,
      email,
      password,
      email_confirmed_at: null,
      user_metadata: userMetadata,
      created_at: now,
      updated_at: now,
      invalidatedTokens: new Set(),
    };

    await enqueueDb(async () => {
      await db.query(
        `insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values ($1, $2, null, $3::jsonb)`,
        [id, email, JSON.stringify(userMetadata)]
      );
    });

    usersById.set(id, user);
    userIdByEmail.set(email, id);
    const confirmCode = `code_${id}`;
    authCodes.set(confirmCode, id);
    return sendJson(res, 200, { user: formatAuthUser(user), session: null });
  }

  if (req.method === 'POST' && subPath === '/token') {
    const grantType = url.searchParams.get('grant_type');
    const body = await readJsonBody(req);

    if (grantType === 'password') {
      const email = String(body.email || '').trim().toLowerCase();
      const password = String(body.password || '');
      const uid = userIdByEmail.get(email);
      const user = uid ? usersById.get(uid) : null;
      if (!user || user.password !== password) {
        return sendJson(res, 400, { error: 'invalid_grant', error_description: 'Invalid login credentials' });
      }
      if (!user.email_confirmed_at) {
        return sendJson(res, 400, { error: 'email_not_confirmed', error_description: 'Email not confirmed' });
      }
      const tokenData = makeJwt(user);
      const refreshToken = `rt_${crypto.randomUUID()}`;
      refreshTokens.set(refreshToken, user.id);
      return sendJson(res, 200, {
        ...tokenData,
        token_type: 'bearer',
        refresh_token: refreshToken,
        user: formatAuthUser(user),
      });
    }

    if (grantType === 'refresh_token') {
      const uid = refreshTokens.get(body.refresh_token);
      const user = uid ? usersById.get(uid) : null;
      if (!user) return sendJson(res, 400, { error: 'invalid_grant' });
      const tokenData = makeJwt(user);
      const refreshToken = `rt_${crypto.randomUUID()}`;
      refreshTokens.set(refreshToken, user.id);
      return sendJson(res, 200, {
        ...tokenData,
        token_type: 'bearer',
        refresh_token: refreshToken,
        user: formatAuthUser(user),
      });
    }

    if (grantType === 'pkce') {
      const code = body.auth_code || body.code;
      const uid = authCodes.get(code);
      const user = uid ? usersById.get(uid) : null;
      if (!user) return sendJson(res, 400, { error: 'invalid_grant' });
      authCodes.delete(code);
      user.email_confirmed_at = user.email_confirmed_at || new Date().toISOString();
      await enqueueDb(async () => {
        await db.query(`update auth.users set email_confirmed_at = $2 where id = $1`, [user.id, user.email_confirmed_at]);
      });
      const tokenData = makeJwt(user);
      const refreshToken = `rt_${crypto.randomUUID()}`;
      refreshTokens.set(refreshToken, user.id);
      return sendJson(res, 200, {
        ...tokenData,
        token_type: 'bearer',
        refresh_token: refreshToken,
        user: formatAuthUser(user),
      });
    }

    return sendJson(res, 400, { error: 'unsupported_grant_type' });
  }

  if (req.method === 'GET' && subPath === '/user') {
    const caller = parseCaller(req);
    if (!caller.user) return sendJson(res, 401, { message: 'Invalid JWT' });
    return sendJson(res, 200, formatAuthUser(caller.user));
  }

  if (req.method === 'PUT' && subPath === '/user') {
    const caller = parseCaller(req);
    if (!caller.user) return sendJson(res, 401, { message: 'Invalid JWT' });
    const body = await readJsonBody(req);
    if (body.password) caller.user.password = String(body.password);
    caller.user.updated_at = new Date().toISOString();
    return sendJson(res, 200, { user: formatAuthUser(caller.user) });
  }

  if (req.method === 'POST' && subPath === '/logout') {
    const caller = parseCaller(req);
    if (caller.user && caller.token) caller.user.invalidatedTokens.add(caller.token);
    return sendJson(res, 204, null);
  }

  if (req.method === 'POST' && subPath === '/recover') {
    await readJsonBody(req);
    return sendJson(res, 200, {});
  }

  return sendJson(res, 404, { message: `Unknown auth endpoint ${subPath}` });
}

async function handleRest(req, res, url) {
  const caller = parseCaller(req);
  const subPath = url.pathname.slice('/rest/v1/'.length);
  const prefer = String(req.headers['prefer'] || '');
  const accept = String(req.headers['accept'] || '');
  const expectSingle = accept.includes('application/vnd.pgrst.object+json');
  const wantRepresentation = prefer.includes('return=representation');
  const wantExactCount = prefer.includes('count=exact');

  try {
    if (subPath.startsWith('rpc/')) {
      const fnName = subPath.slice(4);
      if (!IDENT_RE.test(fnName) || !rpcCatalog.has(fnName)) {
        return sendJson(res, 404, { message: `Unknown RPC ${fnName}` });
      }
      const meta = rpcCatalog.get(fnName);
      const args = await readJsonBody(req);
      const params = [];
      const namedArgs = [];
      for (let i = 0; i < meta.argNames.length; i++) {
        const argName = meta.argNames[i];
        const argType = meta.argTypes[i];
        if (Object.prototype.hasOwnProperty.call(args, argName) && args[argName] !== undefined) {
          params.push(args[argName]);
          namedArgs.push(`"${argName}" => $${params.length}::${argType}`);
        }
      }

      const rpcData = await runWithRole(caller, async (tx) => {
        if (meta.retSet) {
          const r = await tx.query(`select * from public."${fnName}"(${namedArgs.join(', ')})`, params);
          return r.rows;
        }
        const r = await tx.query(`select public."${fnName}"(${namedArgs.join(', ')}) as result`, params);
        return meta.retType === 'void' ? null : r.rows[0]?.result ?? null;
      });
      return sendJson(res, 200, rpcData);
    }

    const table = subPath.replace(/\/$/, '');
    if (!ALLOWED_TABLES.has(table)) {
      return sendJson(res, 404, { message: `Unknown table ${table}` });
    }

    if (req.method === 'GET') {
      const params = [];
      const selectSql = parseSelect(table, url.searchParams.get('select'));
      const whereSql = buildWhere(url.searchParams, params, 't');
      const orderSql = parseOrder(url.searchParams.get('order'), 't');

      let limit = url.searchParams.get('limit') ? Number(url.searchParams.get('limit')) : null;
      let offset = url.searchParams.get('offset') ? Number(url.searchParams.get('offset')) : 0;

      const rangeHeader = req.headers['range'];
      const rangeUnit = req.headers['range-unit'];
      if (rangeHeader && (!rangeUnit || rangeUnit === 'items')) {
        const m = String(rangeHeader).match(/^(\d+)-(\d+)$/);
        if (m) {
          offset = Number(m[1]);
          limit = Number(m[2]) - offset + 1;
        }
      }

      const { rows, total } = await runWithRole(caller, async (tx) => {
        let countVal = null;
        if (wantExactCount) {
          const cr = await tx.query(`select count(*)::int as c from public."${table}" t ${whereSql}`, params);
          countVal = cr.rows[0]?.c ?? 0;
        }
        const limitSql = limit !== null ? `limit ${Math.max(0, limit)} offset ${Math.max(0, offset)}` : '';
        const qr = await tx.query(
          `select ${selectSql} from public."${table}" t ${whereSql} ${orderSql} ${limitSql}`,
          params
        );
        return { rows: cleanNestedRows(qr.rows), total: countVal };
      });

      if (expectSingle) {
        if (rows.length !== 1) {
          return sendJson(res, 406, { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' });
        }
        return sendJson(res, 200, rows[0]);
      }

      const extraHeaders = {};
      if (wantExactCount) {
        extraHeaders['Content-Range'] = rows.length
          ? `${offset}-${offset + rows.length - 1}/${total}`
          : `*/${total ?? 0}`;
      }
      return sendJson(res, 200, rows, extraHeaders);
    }

    if (req.method === 'POST') {
      const body = await readJsonBody(req);
      const records = Array.isArray(body) ? body : [body];
      if (!records.length) return sendJson(res, 201, []);

      const cols = [...new Set(records.flatMap((r) => Object.keys(r)))];
      for (const c of cols) {
        if (!IDENT_RE.test(c)) throw new Error(`Invalid insert column: ${c}`);
      }

      const params = [];
      const valueRows = records.map((rec) => {
        const rowPlaceholders = cols.map((col) => {
          if (rec[col] === undefined) return 'default';
          params.push(rec[col]);
          return `$${params.length}`;
        });
        return `(${rowPlaceholders.join(', ')})`;
      });

      const onConflict = url.searchParams.get('on_conflict');
      let conflictSql = '';
      if (onConflict) {
        const conflictCols = onConflict.split(',').map((c) => {
          const trimmed = c.trim();
          if (!IDENT_RE.test(trimmed)) throw new Error(`Invalid conflict column: ${trimmed}`);
          return `"${trimmed}"`;
        });
        if (prefer.includes('resolution=ignore-duplicates')) {
          conflictSql = `on conflict (${conflictCols.join(', ')}) do nothing`;
        } else if (prefer.includes('resolution=merge-duplicates')) {
          const updates = cols.map((c) => `"${c}" = excluded."${c}"`).join(', ');
          conflictSql = `on conflict (${conflictCols.join(', ')}) do update set ${updates}`;
        }
      }

      const selectSql = wantRepresentation || expectSingle ? `returning ${parseSelect(table, url.searchParams.get('select'))}` : '';
      const sql = `insert into public."${table}" as t (${cols.map((c) => `"${c}"`).join(', ')}) values ${valueRows.join(', ')} ${conflictSql} ${selectSql}`;

      const inserted = await runWithRole(caller, async (tx) => {
        const r = await tx.query(sql, params);
        return cleanNestedRows(r.rows);
      });

      if (expectSingle) {
        if (inserted.length !== 1) return sendJson(res, 406, { code: 'PGRST116', message: 'Expected single row' });
        return sendJson(res, 201, inserted[0]);
      }
      return sendJson(res, 201, wantRepresentation ? inserted : null);
    }

    if (req.method === 'PATCH') {
      const body = await readJsonBody(req);
      const cols = Object.keys(body).filter((k) => body[k] !== undefined);
      if (!cols.length) return sendJson(res, 200, expectSingle ? {} : []);
      const params = [];
      const setClauses = cols.map((col) => {
        if (!IDENT_RE.test(col)) throw new Error(`Invalid update column: ${col}`);
        params.push(body[col]);
        return `"${col}" = $${params.length}`;
      });
      const whereSql = buildWhere(url.searchParams, params, 't');
      const returningSql = wantRepresentation || expectSingle ? `returning ${parseSelect(table, url.searchParams.get('select'))}` : '';

      const updated = await runWithRole(caller, async (tx) => {
        const r = await tx.query(`update public."${table}" t set ${setClauses.join(', ')} ${whereSql} ${returningSql}`, params);
        return cleanNestedRows(r.rows);
      });

      if (expectSingle) {
        if (updated.length !== 1) return sendJson(res, 406, { code: 'PGRST116', message: 'Expected single row' });
        return sendJson(res, 200, updated[0]);
      }
      return sendJson(res, 200, wantRepresentation ? updated : null);
    }

    if (req.method === 'DELETE') {
      const params = [];
      const whereSql = buildWhere(url.searchParams, params, 't');
      const returningSql = wantRepresentation || expectSingle ? `returning ${parseSelect(table, url.searchParams.get('select'))}` : '';

      const deleted = await runWithRole(caller, async (tx) => {
        const r = await tx.query(`delete from public."${table}" t ${whereSql} ${returningSql}`, params);
        return cleanNestedRows(r.rows);
      });

      if (expectSingle) {
        if (deleted.length !== 1) return sendJson(res, 406, { code: 'PGRST116', message: 'Expected single row' });
        return sendJson(res, 200, deleted[0]);
      }
      return sendJson(res, 200, wantRepresentation ? deleted : null);
    }

    return sendJson(res, 405, { message: 'Method not allowed' });
  } catch (err) {
    const status = err?.code === '42501' ? 403 : err?.code === '23505' ? 409 : 400;
    return sendJson(res, status, pgErrorPayload(err));
  }
}

async function handleStorage(req, res, url) {
  const caller = parseCaller(req);
  const subPath = url.pathname.slice('/storage/v1'.length);

  try {
    // Serve signed image URL to browser <img>
    if (req.method === 'GET' && subPath.startsWith('/object/sign/')) {
      const rest = decodeURIComponent(subPath.slice('/object/sign/'.length));
      const token = url.searchParams.get('token') || '';
      const entry = signedUrlTokens.get(token);
      if (!entry || entry.key !== rest || entry.expiresAt < Date.now()) {
        res.writeHead(403, { 'Content-Type': 'text/plain' });
        return res.end('Invalid or expired signed URL');
      }
      const blob = storageBlobs.get(rest);
      if (!blob) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        return res.end('Not found');
      }
      res.writeHead(200, {
        'Content-Type': blob.contentType || 'image/webp',
        'Cache-Control': 'private, max-age=60',
      });
      return res.end(blob.bytes);
    }

    // Create batch signed URLs (enforces storage.objects SELECT RLS!)
    if (req.method === 'POST' && subPath.startsWith('/object/sign/')) {
      const bucket = subPath.slice('/object/sign/'.length).replace(/\/$/, '');
      const body = await readJsonBody(req);
      const paths = Array.isArray(body.paths) ? body.paths : [];
      const expiresIn = Math.max(1, Number(body.expiresIn || 60));

      const allowedNames = await runWithRole(caller, async (tx) => {
        if (!paths.length) return new Set();
        const placeholders = paths.map((_, i) => `$${i + 2}`).join(', ');
        const r = await tx.query(
          `select name from storage.objects where bucket_id = $1 and name in (${placeholders})`,
          [bucket, ...paths]
        );
        return new Set(r.rows.map((row) => row.name));
      });

      const signedList = paths.map((objectPath) => {
        if (!allowedNames.has(objectPath)) {
          return { error: 'Object not found or access denied', path: objectPath, signedURL: null };
        }
        const token = crypto.randomUUID();
        const key = `${bucket}/${objectPath}`;
        signedUrlTokens.set(token, { key, expiresAt: Date.now() + expiresIn * 1000 });
        return {
          error: null,
          path: objectPath,
          signedURL: `/object/sign/${bucket}/${objectPath}?token=${token}`,
        };
      });

      return sendJson(res, 200, signedList);
    }

    // Upload object
    if (req.method === 'POST' && subPath.startsWith('/object/')) {
      const rest = decodeURIComponent(subPath.slice('/object/'.length));
      const slash = rest.indexOf('/');
      const bucket = rest.slice(0, slash);
      const objectPath = rest.slice(slash + 1);
      const bytes = await readRawBody(req);
      const contentType = req.headers['content-type'] || 'application/octet-stream';

      await runWithRole(caller, async (tx) => {
        await tx.query(`insert into storage.objects (bucket_id, name) values ($1, $2)`, [bucket, objectPath]);
      });

      storageBlobs.set(`${bucket}/${objectPath}`, { bytes, contentType });
      return sendJson(res, 200, { Id: crypto.randomUUID(), Key: `${bucket}/${objectPath}` });
    }

    // Remove objects
    if (req.method === 'DELETE' && subPath.startsWith('/object/')) {
      const bucket = subPath.slice('/object/'.length).replace(/\/$/, '');
      const body = await readJsonBody(req);
      const prefixes = Array.isArray(body.prefixes) ? body.prefixes : [];
      await runWithRole(caller, async (tx) => {
        if (!prefixes.length) return;
        const placeholders = prefixes.map((_, i) => `$${i + 2}`).join(', ');
        await tx.query(
          `delete from storage.objects where bucket_id = $1 and name in (${placeholders})`,
          [bucket, ...prefixes]
        );
      });
      for (const p of prefixes) storageBlobs.delete(`${bucket}/${p}`);
      return sendJson(res, 200, []);
    }

    return sendJson(res, 404, { message: `Unknown storage endpoint ${subPath}` });
  } catch (err) {
    return sendJson(res, 403, pgErrorPayload(err));
  }
}

// Test-only out-of-band administration endpoint (simulating Supabase SQL Editor / email confirmation link)
async function handleTestAdmin(req, res) {
  const body = await readJsonBody(req);
  const { action } = body;

  if (action === 'confirm_email') {
    const email = String(body.email || '').trim().toLowerCase();
    const uid = userIdByEmail.get(email);
    const user = uid ? usersById.get(uid) : null;
    if (!user) return sendJson(res, 404, { error: 'User not found' });
    user.email_confirmed_at = new Date().toISOString();
    await enqueueDb(async () => {
      await db.query(`update auth.users set email_confirmed_at = $2 where id = $1`, [user.id, user.email_confirmed_at]);
    });
    return sendJson(res, 200, { ok: true, id: user.id });
  }

  if (action === 'promote_school_admin') {
    const email = String(body.email || '').trim().toLowerCase();
    const uid = userIdByEmail.get(email);
    const user = uid ? usersById.get(uid) : null;
    if (!user) return sendJson(res, 404, { error: 'User not found' });
    user.email_confirmed_at = user.email_confirmed_at || new Date().toISOString();
    await enqueueDb(async () => {
      await db.query(`update auth.users set email_confirmed_at = $2 where id = $1`, [user.id, user.email_confirmed_at]);
      await db.query(
        `update public.profiles set role = 'admin', verification_status = 'approved', seller_approved = true where id = $1`,
        [user.id]
      );
    });
    return sendJson(res, 200, { ok: true, id: user.id });
  }

  return sendJson(res, 400, { error: 'Unknown test admin action' });
}

async function initDatabase() {
  db = new PGlite();
  const bootstrapSql = await fs.readFile(path.join(rootDir, 'supabase', 'tests', 'bootstrap.sql'), 'utf8');
  await db.exec(bootstrapSql);
  const migrationDirectory = path.join(rootDir, 'supabase', 'migrations');
  const migrations = (await fs.readdir(migrationDirectory)).filter((name) => /^\d+_[a-z0-9_]+\.sql$/.test(name)).sort();
  if (!migrations.length) throw new Error('No database migrations found for the isolated test harness.');
  for (const migration of migrations) {
    await db.exec(await fs.readFile(path.join(migrationDirectory, migration), 'utf8'));
  }

  // Introspect public RPC catalog for automatic parameter & return-type marshalling
  const procRes = await db.query(`
    select
      p.proname as name,
      p.proretset as ret_set,
      rt.typname as ret_type,
      coalesce(p.proargnames, '{}'::text[]) as arg_names,
      coalesce(
        array(
          select format_type(unnest(p.proargtypes), null)
        ),
        '{}'::text[]
      ) as arg_types
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    join pg_type rt on rt.oid = p.prorettype
    where n.nspname = 'public'
  `);

  for (const row of procRes.rows) {
    rpcCatalog.set(row.name, {
      retSet: Boolean(row.ret_set),
      retType: row.ret_type,
      argNames: row.arg_names || [],
      argTypes: row.arg_types || [],
    });
  }
}

await initDatabase();

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return sendJson(res, 200, {});
  const url = new URL(req.url || '/', `http://127.0.0.1:${PORT}`);

  if (url.pathname === '/health') {
    return sendJson(res, 200, { ok: true });
  }
  if (url.pathname === '/__test__/admin' && req.method === 'POST') {
    return handleTestAdmin(req, res);
  }
  if (url.pathname.startsWith('/auth/v1')) {
    return handleAuth(req, res, url);
  }
  if (url.pathname.startsWith('/rest/v1/')) {
    return handleRest(req, res, url);
  }
  if (url.pathname.startsWith('/storage/v1/')) {
    return handleStorage(req, res, url);
  }

  return sendJson(res, 404, { message: `Route not found: ${url.pathname}` });
});

server.listen(PORT, '127.0.0.1', () => {
  process.stdout.write(`PGlite Supabase E2E test server listening on http://127.0.0.1:${PORT}\n`);
});
