import "server-only";

/**
 * Atomically applies per-user limits using a Postgres RPC. No in-memory limits:
 * serverless requests may run on different Vercel instances.
 * The SQL migration must be installed before enabling AI requests.
 */
export async function takeOwlAidQuota(userId: string): Promise<boolean> {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !secret) throw new Error("OwlAid quota service is not configured");

  const response = await fetch(`${base.replace(/\/$/, "")}/rest/v1/rpc/owlaid_take_quota`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      apikey: secret,
      Authorization: `Bearer ${secret}`,
    },
    body: JSON.stringify({ p_user_id: userId }),
    cache: "no-store",
    signal: AbortSignal.timeout(6000),
  });
  if (!response.ok) throw new Error(`Quota RPC HTTP ${response.status}`);
  const allowed: unknown = await response.json();
  if (typeof allowed !== "boolean") throw new Error("Unexpected quota RPC response");
  return allowed;
}
