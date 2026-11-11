import { NextRequest, NextResponse } from "next/server";
import { isAllowedRequestOrigin } from "@/lib/server/config";
import { getOwlAidUser } from "@/lib/owlaid/auth";
import { getLocalAnswer } from "@/lib/owlaid/fallback";
import { askGemini } from "@/lib/owlaid/gemini";
import { takeOwlAidQuota } from "@/lib/owlaid/quota";
import { validHistory, type ChatResult } from "@/lib/owlaid/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(data: object, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

function hasValidOrigin(request: NextRequest): boolean {
  if (request.headers.get("sec-fetch-site") === "cross-site") return false;
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    const parsed = new URL(origin);
    if (!["http:", "https:"].includes(parsed.protocol)) return false;
    if (parsed.origin === request.nextUrl.origin) return true;
    return isAllowedRequestOrigin(parsed.origin);
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  if (!hasValidOrigin(request)) {
    return json({ error: "Invalid request origin" }, 403);
  }

  try {
    const user = await getOwlAidUser();
    if (!user) return json({ error: "Sign in to your school account to use OwlAid." }, 401);

    // Reject large bodies before parsing JSON.
    if (Number(request.headers.get("content-length")) > 14000) {
      return json({ error: "Request too large" }, 413);
    }
    const text = await request.text();
    if (text.length > 14000) return json({ error: "Request too large" }, 413);
    let payload: unknown;
    try { payload = JSON.parse(text); } catch { return json({ error: "Invalid JSON" }, 400); }
    if (!payload || typeof payload !== "object") return json({ error: "Invalid request" }, 400);
    const { message, history } = payload as Record<string, unknown>;
    if (typeof message !== "string" || !message.trim() || message.trim().length > 600) {
      return json({ error: "Message must be between 1 and 600 characters" }, 400);
    }
    if (!validHistory(history)) return json({ error: "Invalid conversation history" }, 400);

    const question = message.trim();
    const local = getLocalAnswer(question);
    // Return trusted reference answers without consuming Gemini quota.
    if (local) return json({ reply: local, mode: "local" } satisfies ChatResult);

    if (!process.env.GEMINI_API_KEY) {
      return json({ reply: "I'm in offline mode. I can answer questions about school facts, but I can't answer that question without the AI service.", mode: "local" } satisfies ChatResult);
    }

    let allowed: boolean;
    try { allowed = await takeOwlAidQuota(user.id); }
    catch {
      // Fail closed for API spending; never allow unlimited calls if quota is down.
      return json({ reply: "The AI service is temporarily unavailable. My local school information is still available.", mode: "local", notice: "AI unavailable" } satisfies ChatResult);
    }
    if (!allowed) return json({ error: "OwlAid AI usage limit reached. Please try again later. School facts remain available." }, 429);

    try {
      const { reply, model } = await askGemini(question, history);
      return json({ reply, mode: "ai", model } satisfies ChatResult);
    } catch {
      return json({ reply: "I couldn't reach the AI service right now. Please try again later, or ask me a question about school facts.", mode: "local", notice: "AI unavailable" } satisfies ChatResult);
    }
  } catch {
    return json({ error: "OwlAid is not fully configured yet." }, 503);
  }
}
