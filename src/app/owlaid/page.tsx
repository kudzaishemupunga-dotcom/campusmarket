import type { Metadata } from "next";
import { HubShell } from "@/components/hub/platform-shell";
import OwlAidChat from "@/components/owlaid/OwlAidChat";
import { getHubServerData } from "@/lib/server/hub-data";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "OwlAid 5.0 · IGCSE Study Mode",
  description:
    "Student-built Cambridge IGCSE study tutor and school information assistant for Wise Owl High School Westgate.",
};

export default async function OwlAidPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const rawMode = Array.isArray(params.mode) ? params.mode[0] : params.mode;
  const rawSubject = Array.isArray(params.subject) ? params.subject[0] : params.subject;
  const rawPrompt = Array.isArray(params.prompt) ? params.prompt[0] : params.prompt;

  const hub = await getHubServerData({ includeStudy: false, includeMarketplaceSummary: false });
  const signedInApproved = Boolean(hub.profile && hub.profile.verification_status === "approved");

  return (
    <HubShell path="/owlaid" profile={hub.profile} mode={hub.mode} flushMain>
      <OwlAidChat
        initialMode={rawMode === "igcse" ? "igcse" : "school"}
        initialSubject={rawSubject}
        initialPrompt={rawPrompt}
        signedInApproved={signedInApproved}
      />
    </HubShell>
  );
}
