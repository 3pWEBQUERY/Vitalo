-- Structured facts behind a suggestion, so the app can phrase it in the person's language.
alter table coach_suggestions add column if not exists facts jsonb not null default '{}';
