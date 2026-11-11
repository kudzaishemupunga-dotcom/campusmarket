import "server-only";
import { getSessionContext } from "@/lib/server/auth";

export type OwlAidAuthenticatedUser = {
  id: string;
};

/**
 * Authenticates the caller using CampusMarket's existing server session helper (`getSessionContext`).
 * Requires a verified Supabase session with confirmed email and an approved school profile.
 * Never returns student display names or private student profile attributes for model prompts.
 */
export async function getOwlAidUser(): Promise<OwlAidAuthenticatedUser | null> {
  const { user, profile } = await getSessionContext();
  if (!user || !profile || profile.verification_status !== "approved") {
    return null;
  }
  return { id: user.id };
}
