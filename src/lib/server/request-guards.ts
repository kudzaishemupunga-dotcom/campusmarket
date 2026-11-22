import "server-only";
import type { NextRequest } from "next/server";
import { isAllowedRequestOrigin } from "./config";

export function hasValidOrigin(request: NextRequest): boolean {
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
