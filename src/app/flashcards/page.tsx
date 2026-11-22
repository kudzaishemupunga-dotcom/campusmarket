import type { Metadata } from 'next';
import { HubShell } from '@/components/hub/platform-shell';
import { FlashcardStudio } from '@/components/hub/FlashcardStudio';
import { getHubServerData } from '@/lib/server/hub-data';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'IGCSE Flashcards',
  description:
    'Interactive Cambridge IGCSE flashcards with Leitner/SM-2 spaced repetition, hints, custom student decks, and cloud sync.',
};

export default async function FlashcardsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const rawSubject = Array.isArray(params.subject) ? params.subject[0] : params.subject;
  const rawQueue = Array.isArray(params.queue) ? params.queue[0] : params.queue;

  const hub = await getHubServerData({
    includeStudy: true,
    includeMarketplaceSummary: false,
  });

  return (
    <HubShell path="/flashcards" profile={hub.profile} mode={hub.mode}>
      <FlashcardStudio
        profile={hub.profile}
        initialStudy={hub.study}
        initialSubject={rawSubject}
        initialQueue={rawQueue}
      />
    </HubShell>
  );
}
