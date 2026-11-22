-- Wise Owl Hub 5.0 (Project Leviathan) — Student Study Progress, Quizzes & Flashcards.
-- Isolated and additive: does not alter or delete any existing CampusMarket or OwlAid tables.
-- Review and apply after migrations 202611080001 through 202611110001.
begin;

-- 1. Server-graded Cambridge IGCSE quiz attempts (immutable per-student records)
create table if not exists public.study_quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  subject_id text not null check (
    subject_id in (
      'mathematics',
      'biology',
      'chemistry',
      'physics',
      'computer-science',
      'english',
      'geography',
      'business-studies',
      'mixed'
    )
  ),
  tier text not null check (tier in ('all', 'core', 'extended')),
  mode text not null check (mode in ('practice', 'exam')),
  score integer not null check (score >= 0 and score <= 100),
  total_questions integer not null check (total_questions >= 1 and total_questions <= 100 and score <= total_questions),
  percentage smallint not null check (percentage >= 0 and percentage <= 100),
  grade_band text not null check (grade_band in ('A*', 'A', 'B', 'C', 'D', 'E', 'U')),
  duration_seconds integer not null default 0 check (duration_seconds >= 0 and duration_seconds <= 7200),
  weak_topics text[] not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists study_quiz_attempts_user_created_idx
  on public.study_quiz_attempts (user_id, created_at desc);
create index if not exists study_quiz_attempts_user_subject_idx
  on public.study_quiz_attempts (user_id, subject_id, created_at desc);

-- 2. Custom student-authored study flashcards (private per learner)
create table if not exists public.study_flashcards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  subject_id text not null check (
    subject_id in (
      'mathematics',
      'biology',
      'chemistry',
      'physics',
      'computer-science',
      'english',
      'geography',
      'business-studies'
    )
  ),
  topic text not null check (char_length(btrim(topic)) between 2 and 80),
  front text not null check (char_length(btrim(front)) between 3 and 400),
  back text not null check (char_length(btrim(back)) between 3 and 800),
  hint text check (hint is null or char_length(btrim(hint)) between 2 and 240),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists study_flashcards_user_subject_idx
  on public.study_flashcards (user_id, subject_id, created_at desc);

-- 3. Spaced-repetition flashcard review state (covers both curated and custom cards)
create table if not exists public.study_flashcard_reviews (
  user_id uuid not null references public.profiles(id) on delete cascade,
  card_key text not null check (char_length(btrim(card_key)) between 3 and 120),
  subject_id text not null check (
    subject_id in (
      'mathematics',
      'biology',
      'chemistry',
      'physics',
      'computer-science',
      'english',
      'geography',
      'business-studies'
    )
  ),
  box smallint not null default 1 check (box between 0 and 5),
  ease_factor numeric(4,2) not null default 2.50 check (ease_factor between 1.30 and 3.50),
  interval_days integer not null default 0 check (interval_days >= 0 and interval_days <= 365),
  repetitions integer not null default 0 check (repetitions >= 0 and repetitions <= 10000),
  lapses integer not null default 0 check (lapses >= 0 and lapses <= 10000),
  last_rating text not null check (last_rating in ('again', 'hard', 'good', 'easy')),
  next_review_at timestamptz not null default now(),
  reviewed_at timestamptz not null default now(),
  primary key (user_id, card_key)
);

create index if not exists study_flashcard_reviews_user_due_idx
  on public.study_flashcard_reviews (user_id, next_review_at asc);

-- Guard trigger for custom flashcards: enforces per-user card limit (200) and immutable ownership
create or replace function private.guard_study_flashcard() returns trigger
language plpgsql set search_path = '' as $$
declare
  card_count integer;
begin
  if tg_op = 'INSERT' then
    if auth.uid() is not null and current_user in ('authenticated', 'anon') then
      if new.user_id <> auth.uid() then
        raise exception 'Flashcards belong strictly to your own account.' using errcode = '42501';
      end if;
    end if;
    select count(*)::integer into card_count
    from public.study_flashcards
    where user_id = new.user_id;
    if card_count >= 200 then
      raise exception 'Custom flashcard limit reached (200 cards per learner).' using errcode = '23514';
    end if;
    new.created_at := now();
    new.updated_at := now();
    return new;
  end if;

  if new.id <> old.id or new.user_id <> old.user_id or new.created_at <> old.created_at then
    raise exception 'Flashcard ownership cannot be changed.' using errcode = '42501';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists study_flashcards_guard on public.study_flashcards;
create trigger study_flashcards_guard
  before insert or update on public.study_flashcards
  for each row execute function private.guard_study_flashcard();

-- Guard trigger for quiz attempts: prevents spoofed ownership or timestamps
create or replace function private.guard_study_quiz_attempt() returns trigger
language plpgsql set search_path = '' as $$
begin
  if auth.uid() is not null and current_user in ('authenticated', 'anon') then
    if new.user_id <> auth.uid() then
      raise exception 'Quiz attempts belong strictly to your own account.' using errcode = '42501';
    end if;
  end if;
  new.created_at := now();
  return new;
end;
$$;

drop trigger if exists study_quiz_attempts_guard on public.study_quiz_attempts;
create trigger study_quiz_attempts_guard
  before insert on public.study_quiz_attempts
  for each row execute function private.guard_study_quiz_attempt();

-- Guard trigger for flashcard reviews: prevents ownership reassignment
create or replace function private.guard_study_flashcard_review() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if auth.uid() is not null and current_user in ('authenticated', 'anon') then
      if new.user_id <> auth.uid() then
        raise exception 'Flashcard reviews belong strictly to your own account.' using errcode = '42501';
      end if;
    end if;
    new.reviewed_at := now();
    return new;
  end if;

  if new.user_id <> old.user_id or new.card_key <> old.card_key then
    raise exception 'Flashcard review identity cannot be changed.' using errcode = '42501';
  end if;
  new.reviewed_at := now();
  return new;
end;
$$;

drop trigger if exists study_flashcard_reviews_guard on public.study_flashcard_reviews;
create trigger study_flashcard_reviews_guard
  before insert or update on public.study_flashcard_reviews
  for each row execute function private.guard_study_flashcard_review();

-- Strict Row Level Security & minimal privileges
alter table public.study_quiz_attempts enable row level security;
alter table public.study_flashcards enable row level security;
alter table public.study_flashcard_reviews enable row level security;

revoke all on table public.study_quiz_attempts from public, anon, authenticated;
revoke all on table public.study_flashcards from public, anon, authenticated;
revoke all on table public.study_flashcard_reviews from public, anon, authenticated;

grant select, insert, delete on table public.study_quiz_attempts to authenticated;
grant select, insert, update, delete on table public.study_flashcards to authenticated;
grant select, insert, update, delete on table public.study_flashcard_reviews to authenticated;

drop policy if exists study_quiz_attempts_owner_select on public.study_quiz_attempts;
drop policy if exists study_quiz_attempts_owner_insert on public.study_quiz_attempts;
drop policy if exists study_quiz_attempts_owner_delete on public.study_quiz_attempts;
create policy study_quiz_attempts_owner_select on public.study_quiz_attempts
  for select to authenticated
  using (private.is_approved() and user_id = auth.uid());
create policy study_quiz_attempts_owner_insert on public.study_quiz_attempts
  for insert to authenticated
  with check (private.is_approved() and user_id = auth.uid());
create policy study_quiz_attempts_owner_delete on public.study_quiz_attempts
  for delete to authenticated
  using (private.is_approved() and user_id = auth.uid());

drop policy if exists study_flashcards_owner_select on public.study_flashcards;
drop policy if exists study_flashcards_owner_insert on public.study_flashcards;
drop policy if exists study_flashcards_owner_update on public.study_flashcards;
drop policy if exists study_flashcards_owner_delete on public.study_flashcards;
create policy study_flashcards_owner_select on public.study_flashcards
  for select to authenticated
  using (private.is_approved() and user_id = auth.uid());
create policy study_flashcards_owner_insert on public.study_flashcards
  for insert to authenticated
  with check (private.is_approved() and user_id = auth.uid());
create policy study_flashcards_owner_update on public.study_flashcards
  for update to authenticated
  using (private.is_approved() and user_id = auth.uid())
  with check (private.is_approved() and user_id = auth.uid());
create policy study_flashcards_owner_delete on public.study_flashcards
  for delete to authenticated
  using (private.is_approved() and user_id = auth.uid());

drop policy if exists study_flashcard_reviews_owner_select on public.study_flashcard_reviews;
drop policy if exists study_flashcard_reviews_owner_insert on public.study_flashcard_reviews;
drop policy if exists study_flashcard_reviews_owner_update on public.study_flashcard_reviews;
drop policy if exists study_flashcard_reviews_owner_delete on public.study_flashcard_reviews;
create policy study_flashcard_reviews_owner_select on public.study_flashcard_reviews
  for select to authenticated
  using (private.is_approved() and user_id = auth.uid());
create policy study_flashcard_reviews_owner_insert on public.study_flashcard_reviews
  for insert to authenticated
  with check (private.is_approved() and user_id = auth.uid());
create policy study_flashcard_reviews_owner_update on public.study_flashcard_reviews
  for update to authenticated
  using (private.is_approved() and user_id = auth.uid())
  with check (private.is_approved() and user_id = auth.uid());
create policy study_flashcard_reviews_owner_delete on public.study_flashcard_reviews
  for delete to authenticated
  using (private.is_approved() and user_id = auth.uid());

commit;
