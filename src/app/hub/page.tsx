import type { Metadata } from 'next';
import { HubShell } from '@/components/hub/platform-shell';
import { StudentDashboard } from '@/components/hub/StudentDashboard';
import { getHubServerData } from '@/lib/server/hub-data';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Student Hub',
  description:
    'Unified student dashboard for Wise Owl High School Westgate: Cambridge IGCSE readiness, OwlAid Study Mode, quizzes, flashcards, and CampusMarket.',
};

export default async function HubPage() {
  const hub = await getHubServerData({
    includeStudy: true,
    includeMarketplaceSummary: true,
  });

  return (
    <HubShell path="/hub" profile={hub.profile} mode={hub.mode}>
      <StudentDashboard
        profile={hub.profile}
        initialStudy={hub.study}
        marketplaceSummary={hub.marketplaceSummary}
      />
    </HubShell>
  );
}
