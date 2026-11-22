
-- Project Leviathan
-- Server-side study persistence permissions
-- Forward-only migration 006

BEGIN;

-- Server-graded quiz attempts
GRANT SELECT, INSERT
ON TABLE public.study_quiz_attempts
TO service_role;

-- Server-managed flashcard review scheduling
GRANT SELECT, INSERT, UPDATE
ON TABLE public.study_flashcard_reviews
TO service_role;

COMMIT;
