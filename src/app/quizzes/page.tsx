import type { Metadata } from 'next';
import { HubShell } from '@/components/hub/platform-shell';
import { QuizStudio } from '@/components/hub/QuizStudio';
import { getHubServerData } from '@/lib/server/hub-data';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'IGCSE Quizzes',
  description:
    'Interactive Cambridge IGCSE subject quizzes with server-verified scoring, grade estimates, topic mastery diagnostics, and OwlAid explanations.',
};

export default async function QuizzesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const rawSubject = Array.isArray(params.subject) ? params.subject[0] : params.subject;

  const hub = await getHubServerData({
    includeStudy: true,
    includeMarketplaceSummary: false,
  });

  return (
    <HubShell path="/quizzes" profile={hub.profile} mode={hub.mode}>
      <QuizStudio
        profile={hub.profile}
        initialStudy={hub.study}
        initialSubject={rawSubject}
      />
    </HubShell>
  );
}
