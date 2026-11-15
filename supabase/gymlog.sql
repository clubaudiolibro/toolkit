-- =====================================================================
-- GymLog — preparazione del database Supabase
--
-- Come si usa: Supabase → SQL Editor → New query → incolla TUTTO questo
-- file → Run. Si può rilanciare quante volte si vuole: non cancella dati
-- e non tocca le tabelle delle altre app (tutte le tabelle qui hanno il
-- prefisso gym_).
--
-- Contiene:
--   * tabelle di GymLog (esercizi, gruppi, allenamenti, diario, impostazioni)
--   * sicurezza a livello di riga (RLS): ognuno vede solo le proprie righe
--   * nessun accesso al ruolo "anon" (chi non ha fatto login)
--
-- Le voci predefinite (gruppi muscolari, attrezzi) le inserisce l'app al
-- primo avvio, perché qui nel SQL Editor non c'è un utente collegato.
--
-- Versione dello schema: 1 (vedi gym_schema_version e apps/gymlog/js/config.js)
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. TABELLE
-- ---------------------------------------------------------------------

-- Gruppi muscolari (petto, dorso, ...) — lista personalizzabile
create table if not exists public.gym_muscles (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

-- Attrezzi (manubri, bilanciere, ...) — lista personalizzabile
create table if not exists public.gym_equipment (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

-- Esercizi (deleted_at valorizzato = nel cestino)
create table if not exists public.gym_exercises (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name          text not null,
  equipment_id  uuid references public.gym_equipment (id) on delete set null,
  efficacy      text,                         -- 'bassa' | 'media' | 'alta' | null
  description   text,
  video_url     text,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz
);

-- Collegamento esercizio ↔ gruppi muscolari (molti a molti)
create table if not exists public.gym_exercise_muscles (
  exercise_id uuid not null references public.gym_exercises (id) on delete cascade,
  muscle_id   uuid not null references public.gym_muscles (id) on delete cascade,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  primary key (exercise_id, muscle_id)
);

-- Gruppi di esercizi (es. "Gambe")
create table if not exists public.gym_groups (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null,
  created_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

-- Esercizi dentro un gruppo, con i valori dell'ultima volta
create table if not exists public.gym_group_items (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  group_id    uuid not null references public.gym_groups (id) on delete cascade,
  exercise_id uuid not null references public.gym_exercises (id) on delete cascade,
  position    integer not null default 0,
  sets        smallint,
  reps        smallint,
  weight      numeric(6,2),
  wu_sets     smallint,                       -- riscaldamento (facoltativo)
  wu_reps     smallint,
  wu_weight   numeric(6,2),
  created_at  timestamptz not null default now()
);

-- Allenamenti (es. "Allenamento A"); position = ordine nella lista
create table if not exists public.gym_workouts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null,
  position    integer not null default 0,
  created_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

-- Elementi di un allenamento: un gruppo oppure un esercizio singolo (con i suoi valori)
create table if not exists public.gym_workout_items (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  workout_id  uuid not null references public.gym_workouts (id) on delete cascade,
  position    integer not null default 0,
  kind        text not null,                  -- 'group' | 'exercise'
  group_id    uuid references public.gym_groups (id) on delete cascade,
  exercise_id uuid references public.gym_exercises (id) on delete cascade,
  sets        smallint,
  reps        smallint,
  weight      numeric(6,2),
  wu_sets     smallint,
  wu_reps     smallint,
  wu_weight   numeric(6,2),
  created_at  timestamptz not null default now()
);

-- Tipi di attività che non sono allenamenti (es. Corsa)
create table if not exists public.gym_activity_types (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null,
  created_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

-- Diario: una riga per ogni allenamento/attività svolti in un giorno.
-- name conserva il nome al momento, così lo storico resta leggibile anche dopo un'eliminazione.
create table if not exists public.gym_diary (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day         date not null,
  workout_id  uuid references public.gym_workouts (id) on delete set null,
  activity_id uuid references public.gym_activity_types (id) on delete set null,
  name        text not null,
  stars       smallint,
  created_at  timestamptz not null default now()
);

-- Impostazioni (una riga per utente)
create table if not exists public.gym_settings (
  user_id         uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  timer_presets   jsonb not null default '[45, 60, 90, 120]'::jsonb,   -- secondi
  last_backup_at  timestamptz,
  seeded_at       timestamptz,                -- voci predefinite già inserite
  updated_at      timestamptz not null default now()
);

-- Vincoli (aggiunti solo se mancano, così il file resta rilanciabile)
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'gym_exercises_efficacy_check') then
    alter table public.gym_exercises add constraint gym_exercises_efficacy_check
      check (efficacy is null or efficacy in ('bassa', 'media', 'alta'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'gym_workout_items_kind_check') then
    alter table public.gym_workout_items add constraint gym_workout_items_kind_check
      check ((kind = 'group' and group_id is not null and exercise_id is null)
          or (kind = 'exercise' and exercise_id is not null and group_id is null));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'gym_diary_stars_check') then
    alter table public.gym_diary add constraint gym_diary_stars_check
      check (stars is null or stars between 1 and 5);
  end if;
end $$;

-- Nomi unici (senza distinguere maiuscole) per le liste personalizzabili
create unique index if not exists gym_muscles_unique_name   on public.gym_muscles   (user_id, lower(name));
create unique index if not exists gym_equipment_unique_name on public.gym_equipment (user_id, lower(name));

-- Indici per le ricerche più frequenti
create index if not exists gym_muscles_user_idx          on public.gym_muscles (user_id);
create index if not exists gym_equipment_user_idx        on public.gym_equipment (user_id);
create index if not exists gym_exercises_user_idx        on public.gym_exercises (user_id);
create index if not exists gym_exercise_muscles_user_idx on public.gym_exercise_muscles (user_id);
create index if not exists gym_groups_user_idx           on public.gym_groups (user_id);
create index if not exists gym_group_items_group_idx     on public.gym_group_items (group_id);
create index if not exists gym_group_items_user_idx      on public.gym_group_items (user_id);
create index if not exists gym_workouts_user_idx         on public.gym_workouts (user_id);
create index if not exists gym_workout_items_wk_idx      on public.gym_workout_items (workout_id);
create index if not exists gym_workout_items_user_idx    on public.gym_workout_items (user_id);
create index if not exists gym_activity_types_user_idx   on public.gym_activity_types (user_id);
create index if not exists gym_diary_user_day_idx        on public.gym_diary (user_id, day);


-- ---------------------------------------------------------------------
-- 2. PERMESSI E RLS: niente per "anon"; per "authenticated" solo le proprie righe
-- ---------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array['gym_muscles', 'gym_equipment', 'gym_exercises', 'gym_exercise_muscles',
                           'gym_groups', 'gym_group_items', 'gym_workouts', 'gym_workout_items',
                           'gym_activity_types', 'gym_diary', 'gym_settings']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from anon', t);
    execute format('grant select, insert, update, delete on table public.%I to authenticated', t);
    execute format('drop policy if exists %I on public.%I', t || '_own', t);
    execute format('create policy %I on public.%I for all to authenticated '
                   'using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))',
                   t || '_own', t);
  end loop;
end $$;


-- ---------------------------------------------------------------------
-- 3. VERSIONE DELLO SCHEMA (l'app la controlla all'avvio)
-- ---------------------------------------------------------------------

create or replace function public.gym_schema_version()
returns integer
language sql immutable
set search_path = ''
as $$ select 1 $$;

revoke all on function public.gym_schema_version() from public, anon;
grant execute on function public.gym_schema_version() to authenticated;


-- ---------------------------------------------------------------------
-- 4. CONTROLLO FINALE: deve mostrare 11 righe, tutte con rowsecurity = true
-- ---------------------------------------------------------------------

select tablename, rowsecurity from pg_tables
where schemaname = 'public' and tablename like 'gym\_%'
order by tablename;
