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
-- Versione dello schema: 3 (vedi gym_schema_version e apps/gymlog/js/config.js)
--   v2: gym_diary.kind ('workout' | 'activity'), così una voce resta "attività" anche
--       se il tipo di attività viene eliminato definitivamente dal cestino
--   v3: funzione gym_restore(payload) per il ripristino del backup in un colpo solo
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

-- v2: tipo di voce (aggiunto anche ai database creati con la versione 1)
alter table public.gym_diary add column if not exists kind text not null default 'workout';
update public.gym_diary set kind = 'activity' where activity_id is not null and kind <> 'activity';

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
  if not exists (select 1 from pg_constraint where conname = 'gym_diary_kind_check') then
    alter table public.gym_diary add constraint gym_diary_kind_check
      check (kind in ('workout', 'activity'));
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
-- 3. RIPRISTINO DEL BACKUP (v3)
--
-- gym_restore(payload) sostituisce TUTTI i dati GymLog dell'utente collegato con quelli
-- del file di backup (payload = la parte "data" del file JSON). Tutto avviene in
-- un'unica operazione: se qualcosa va storto non cambia niente.
-- "security invoker": gira con i permessi dell'utente, quindi valgono le regole RLS;
-- user_id viene sempre preso dall'utente collegato, mai dal file.
-- ---------------------------------------------------------------------

create or replace function public.gym_restore(payload jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'Utente non collegato';
  end if;
  if payload is null or jsonb_typeof(payload) <> 'object' then
    raise exception 'File di backup non valido';
  end if;

  -- 1) cancellazione: prima i "figli", poi i "genitori"
  delete from public.gym_diary            where user_id = me;
  delete from public.gym_workout_items    where user_id = me;
  delete from public.gym_workouts         where user_id = me;
  delete from public.gym_group_items      where user_id = me;
  delete from public.gym_groups           where user_id = me;
  delete from public.gym_exercise_muscles where user_id = me;
  delete from public.gym_exercises        where user_id = me;
  delete from public.gym_activity_types   where user_id = me;
  delete from public.gym_equipment        where user_id = me;
  delete from public.gym_muscles          where user_id = me;

  -- 2) reinserimento: prima i "genitori", poi i "figli" (stessi id del file)
  insert into public.gym_muscles (id, user_id, name, sort_order, created_at)
  select r.id, me, r.name, coalesce(r.sort_order, 0), coalesce(r.created_at, now())
  from jsonb_populate_recordset(null::public.gym_muscles, coalesce(payload->'muscles', '[]')) r;

  insert into public.gym_equipment (id, user_id, name, sort_order, created_at)
  select r.id, me, r.name, coalesce(r.sort_order, 0), coalesce(r.created_at, now())
  from jsonb_populate_recordset(null::public.gym_equipment, coalesce(payload->'equipment', '[]')) r;

  insert into public.gym_activity_types (id, user_id, name, created_at, deleted_at)
  select r.id, me, r.name, coalesce(r.created_at, now()), r.deleted_at
  from jsonb_populate_recordset(null::public.gym_activity_types, coalesce(payload->'activity_types', '[]')) r;

  insert into public.gym_exercises (id, user_id, name, equipment_id, efficacy, description, video_url, notes,
                                    created_at, updated_at, deleted_at)
  select r.id, me, r.name, r.equipment_id, r.efficacy, r.description, r.video_url, r.notes,
         coalesce(r.created_at, now()), coalesce(r.updated_at, now()), r.deleted_at
  from jsonb_populate_recordset(null::public.gym_exercises, coalesce(payload->'exercises', '[]')) r;

  insert into public.gym_exercise_muscles (exercise_id, muscle_id, user_id)
  select r.exercise_id, r.muscle_id, me
  from jsonb_populate_recordset(null::public.gym_exercise_muscles, coalesce(payload->'exercise_muscles', '[]')) r;

  insert into public.gym_groups (id, user_id, name, created_at, deleted_at)
  select r.id, me, r.name, coalesce(r.created_at, now()), r.deleted_at
  from jsonb_populate_recordset(null::public.gym_groups, coalesce(payload->'groups', '[]')) r;

  insert into public.gym_group_items (id, user_id, group_id, exercise_id, position,
                                      sets, reps, weight, wu_sets, wu_reps, wu_weight, created_at)
  select r.id, me, r.group_id, r.exercise_id, coalesce(r.position, 0),
         r.sets, r.reps, r.weight, r.wu_sets, r.wu_reps, r.wu_weight, coalesce(r.created_at, now())
  from jsonb_populate_recordset(null::public.gym_group_items, coalesce(payload->'group_items', '[]')) r;

  insert into public.gym_workouts (id, user_id, name, position, created_at, deleted_at)
  select r.id, me, r.name, coalesce(r.position, 0), coalesce(r.created_at, now()), r.deleted_at
  from jsonb_populate_recordset(null::public.gym_workouts, coalesce(payload->'workouts', '[]')) r;

  insert into public.gym_workout_items (id, user_id, workout_id, position, kind, group_id, exercise_id,
                                        sets, reps, weight, wu_sets, wu_reps, wu_weight, created_at)
  select r.id, me, r.workout_id, coalesce(r.position, 0), r.kind, r.group_id, r.exercise_id,
         r.sets, r.reps, r.weight, r.wu_sets, r.wu_reps, r.wu_weight, coalesce(r.created_at, now())
  from jsonb_populate_recordset(null::public.gym_workout_items, coalesce(payload->'workout_items', '[]')) r;

  insert into public.gym_diary (id, user_id, day, workout_id, activity_id, name, stars, kind, created_at)
  select r.id, me, r.day, r.workout_id, r.activity_id, r.name, r.stars,
         coalesce(r.kind, case when r.activity_id is not null then 'activity' else 'workout' end),
         coalesce(r.created_at, now())
  from jsonb_populate_recordset(null::public.gym_diary, coalesce(payload->'diary', '[]')) r;

  -- 3) impostazioni: solo i preset del timer (data dell'ultimo backup e preparazione restano)
  if jsonb_typeof(payload->'settings'->'timer_presets') = 'array' then
    insert into public.gym_settings (user_id, timer_presets, seeded_at, updated_at)
    values (me, payload->'settings'->'timer_presets', now(), now())
    on conflict (user_id) do update
      set timer_presets = excluded.timer_presets, updated_at = now();
  end if;

  return jsonb_build_object(
    'exercises', (select count(*) from public.gym_exercises where user_id = me),
    'workouts',  (select count(*) from public.gym_workouts  where user_id = me),
    'diary',     (select count(*) from public.gym_diary     where user_id = me));
end;
$$;

revoke all on function public.gym_restore(jsonb) from public, anon;
grant execute on function public.gym_restore(jsonb) to authenticated;


-- ---------------------------------------------------------------------
-- 4. VERSIONE DELLO SCHEMA (l'app la controlla all'avvio)
-- ---------------------------------------------------------------------

create or replace function public.gym_schema_version()
returns integer
language sql immutable
set search_path = ''
as $$ select 3 $$;

revoke all on function public.gym_schema_version() from public, anon;
grant execute on function public.gym_schema_version() to authenticated;


-- ---------------------------------------------------------------------
-- 5. CONTROLLO FINALE: deve mostrare 11 righe, tutte con rowsecurity = true
-- ---------------------------------------------------------------------

select tablename, rowsecurity from pg_tables
where schemaname = 'public' and tablename like 'gym\_%'
order by tablename;
