-- =====================================================================
-- FilmShelf — preparazione del database Supabase
--
-- Come si usa: Supabase → SQL Editor → New query → incolla TUTTO questo
-- file → Run. Si può rilanciare quante volte si vuole: non cancella dati
-- e non tocca le tabelle delle altre app (tutte le tabelle qui hanno il
-- prefisso filmshelf_).
--
-- Contiene:
--   * filmshelf_film          una riga per film (visti e watchlist)
--   * filmshelf_impostazioni  la chiave TMDB e l'elenco dei tag (una riga per utente)
--   * sicurezza a livello di riga (RLS): ognuno vede solo le proprie righe
--   * nessun accesso al ruolo "anon" (chi non ha fatto login)
--
-- La chiave TMDB NON è scritta qui: la inserisce l'app la prima volta,
-- così non finisce mai nella repository pubblica.
--
-- Versione dello schema: 2 (vedi filmshelf_schema_version e apps/filmshelf/js/config.js)
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. TABELLE
-- ---------------------------------------------------------------------

-- Film: una riga per film. Se un film viene rivisto si aggiornano data e voto.
create table if not exists public.filmshelf_film (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null default auth.uid() references auth.users (id) on delete cascade,
  tmdb_id           integer not null,
  titolo_it         text not null,
  titolo_originale  text,
  anno              smallint,
  durata_min        integer,
  generi            text[] not null default '{}',
  trama             text,
  poster_path       text,                 -- solo il percorso (es. "/abc.jpg"), l'immagine resta su TMDB
  stato             text not null default 'visto',
  data_visione      date,
  voto              numeric(3,1),
  note              text,
  luoghi            text[] not null default '{}',   -- nell'app si chiamano «tag» (anche più di uno, liberi)
  creato_il         timestamptz not null default now(),
  aggiornato_il     timestamptz not null default now(),

  -- niente duplicati: lo stesso film TMDB una sola volta per utente
  constraint filmshelf_film_tmdb_unico unique (user_id, tmdb_id),
  constraint filmshelf_film_stato check (stato in ('visto', 'watchlist')),
  -- voto da 1 a 10 a passi di 0,5 (oppure vuoto)
  constraint filmshelf_film_voto check (voto is null or (voto between 1 and 10 and voto * 2 = trunc(voto * 2))),
  constraint filmshelf_film_durata check (durata_min is null or durata_min >= 0),
  constraint filmshelf_film_anno check (anno is null or anno between 1870 and 2100)
);

create index if not exists filmshelf_film_user_idx on public.filmshelf_film (user_id, stato);

-- Impostazioni: chiave TMDB ed elenco dei tag (leggibili solo dall'utente collegato)
create table if not exists public.filmshelf_impostazioni (
  user_id        uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  tmdb_key       text,
  aggiornato_il  timestamptz not null default now()
);

-- Schema 2: i tag sono liberi (prima solo Cinema, The Space Pass, Casa) e l'elenco si salva qui.
-- tag_elenco vuoto (null) = l'app usa i tre tag di partenza.
alter table public.filmshelf_film drop constraint if exists filmshelf_film_luoghi;
alter table public.filmshelf_impostazioni add column if not exists tag_elenco text[];

-- aggiornato_il si aggiorna da solo a ogni modifica
create or replace function public.filmshelf_touch()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.aggiornato_il := now();
  return new;
end;
$$;

drop trigger if exists filmshelf_film_touch on public.filmshelf_film;
create trigger filmshelf_film_touch before update on public.filmshelf_film
  for each row execute function public.filmshelf_touch();

drop trigger if exists filmshelf_impostazioni_touch on public.filmshelf_impostazioni;
create trigger filmshelf_impostazioni_touch before update on public.filmshelf_impostazioni
  for each row execute function public.filmshelf_touch();


-- ---------------------------------------------------------------------
-- 2. PERMESSI E RLS: niente per "anon"; per "authenticated" solo le proprie righe
-- ---------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array['filmshelf_film', 'filmshelf_impostazioni']
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

create or replace function public.filmshelf_schema_version()
returns integer
language sql immutable
set search_path = ''
as $$ select 2 $$;

revoke all on function public.filmshelf_schema_version() from public, anon;
grant execute on function public.filmshelf_schema_version() to authenticated;


-- ---------------------------------------------------------------------
-- 4. CONTROLLO FINALE: deve mostrare 2 righe, tutte con rowsecurity = true
-- ---------------------------------------------------------------------

select tablename, rowsecurity from pg_tables
where schemaname = 'public' and tablename like 'filmshelf\_%'
order by tablename;
