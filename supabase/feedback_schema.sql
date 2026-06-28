create extension if not exists pgcrypto;

create table if not exists public.detection_predictions (
  id uuid primary key default gen_random_uuid(),
  prediction_id text not null unique,
  user_id uuid references auth.users(id) on delete set null,
  image_hash text not null,
  perceptual_hash text,
  filename text,
  content_type text,
  model_version text not null default 'full_v1',
  prediction text not null,
  model_prediction text not null,
  decision text not null,
  confidence double precision not null,
  margin double precision,
  normalized_entropy double precision,
  all_probabilities jsonb not null default '{}'::jsonb,
  feedback_adjusted jsonb not null default '{"applied": false}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists detection_predictions_image_hash_idx
  on public.detection_predictions (image_hash);

create index if not exists detection_predictions_created_at_idx
  on public.detection_predictions (created_at desc);

create table if not exists public.detection_feedback (
  id uuid primary key default gen_random_uuid(),
  prediction_id uuid not null references public.detection_predictions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  image_hash text not null,
  perceptual_hash text,
  corrected_label text not null,
  is_correct boolean not null,
  reviewed_prediction text,
  reviewed_confidence double precision,
  class_switched boolean not null default false,
  low_confidence_class_switch boolean not null default false,
  low_confidence_correct_feedback boolean not null default false,
  low_confidence_baked_feedback boolean not null default false,
  baked_confidence double precision,
  training_consent boolean not null default false,
  image_object_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (prediction_id, user_id)
);

alter table public.detection_feedback
  add column if not exists reviewed_prediction text,
  add column if not exists reviewed_confidence double precision,
  add column if not exists class_switched boolean not null default false,
  add column if not exists low_confidence_class_switch boolean not null default false,
  add column if not exists low_confidence_correct_feedback boolean not null default false,
  add column if not exists low_confidence_baked_feedback boolean not null default false,
  add column if not exists baked_confidence double precision;

create index if not exists detection_feedback_image_hash_idx
  on public.detection_feedback (image_hash);

create index if not exists detection_feedback_updated_at_idx
  on public.detection_feedback (updated_at desc);

create or replace function public.set_detection_feedback_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists detection_feedback_set_updated_at on public.detection_feedback;
create trigger detection_feedback_set_updated_at
before update on public.detection_feedback
for each row
execute function public.set_detection_feedback_updated_at();

alter table public.detection_predictions enable row level security;
alter table public.detection_feedback enable row level security;

insert into storage.buckets (id, name, public)
values ('feedback-images', 'feedback-images', false)
on conflict (id) do update
set public = excluded.public;
