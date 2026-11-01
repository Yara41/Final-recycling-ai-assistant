// Test harness: a throwaway in-memory Postgres (PGlite) that imitates the parts of
// Supabase the migration relies on (auth schema, auth.uid(), roles, default grants,
// extensions schema), then applies the real migration and seed files.
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { vector } from '@electric-sql/pglite-pgvector';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';

const root = new URL('../../', import.meta.url);
const read = (p) => readFile(new URL(p, root), 'utf8');

export const MIGRATION = 'supabase/migrations/20261031120000_campus_agent.sql';
export const VERIFIED = 'supabase/migrations/20261101120000_verified_points.sql';
export const SNAPSHOT = 'supabase/migrations/20261102120000_campus_snapshot.sql';
export const SEED = 'supabase/seed/demo_university.sql';
export const DEMO_UNI = '00000000-0000-4000-8000-000000000001';

const SUPABASE_STUB = `
create schema auth;
create schema extensions;
create extension pgcrypto schema extensions;
create extension vector schema extensions;
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create table auth.users (
  id uuid primary key, instance_id uuid, aud text, role text, email text,
  encrypted_password text, raw_app_meta_data jsonb, raw_user_meta_data jsonb,
  is_anonymous boolean default false, email_confirmed_at timestamptz,
  created_at timestamptz, updated_at timestamptz
);
create function auth.uid() returns uuid language sql stable as
  $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create function auth.role() returns text language sql stable as
  $$ select nullif(current_setting('request.jwt.claim.role', true), '') $$;
grant usage on schema public, auth, extensions to anon, authenticated, service_role;
grant execute on all functions in schema auth to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
create table public.documents (id bigserial primary key, content text, metadata jsonb, embedding extensions.vector(3));
`;

export async function freshDb({ seed = true } = {}) {
  const db = await PGlite.create({ extensions: { vector, pgcrypto } });
  await db.exec(SUPABASE_STUB);
  await db.exec(await read(MIGRATION));
  await db.exec(await read(VERIFIED));
  await db.exec(await read(SNAPSHOT));
  if (seed) await db.exec(await read(SEED));
  return db;
}

export async function addUser(db, id) {
  await db.query('insert into auth.users (id, aud, role) values ($1, $2, $3)', [id, 'authenticated', 'authenticated']);
  return id;
}

async function as(db, role, sub, fn) {
  return db.transaction(async (tx) => {
    await tx.exec(`set local role ${role}`);
    await tx.query("select set_config('request.jwt.claim.sub', $1, true), set_config('request.jwt.claim.role', $2, true)", [sub ?? '', role]);
    return fn(tx);
  });
}

export const asUser = (db, id, fn) => as(db, 'authenticated', id, fn);
export const asService = (db, fn) => as(db, 'service_role', null, fn);
export const asAnon = (db, fn) => as(db, 'anon', null, fn);

export async function rows(tx, sql, params = []) {
  return (await tx.query(sql, params)).rows;
}

export async function one(tx, sql, params = []) {
  return (await tx.query(sql, params)).rows[0];
}

export const LOC_ENG = '00000000-0000-4000-8000-000000000101';

// Creates a second university with one location, for cross-tenant tests.
export async function addUniversity(db, id = '00000000-0000-4000-8000-000000000002') {
  await db.query(
    `insert into universities (id, name, country, bins) values ($1, 'Other University', 'JO',
      '[{"id":"plastic","label_ar":"بلاستيك","label_en":"Plastic","color":"#2563eb","accepts":["plastic"]}]')`,
    [id],
  );
  const loc = '00000000-0000-4000-8000-000000000201';
  await db.query(`insert into locations (id, university_id, name, kind) values ($1, $2, 'Other station', 'bin_station')`, [loc, id]);
  return { id, loc };
}

// Signs a fresh user up as a member of a university through the public function.
export async function member(db, id, { uni = DEMO_UNI, role = 'student', faculty = 'Engineering' } = {}) {
  await addUser(db, id);
  await asUser(db, id, (tx) => tx.query('select create_profile($1, $2, $3, $4)', [uni, role, faculty, 'Test']));
  return id;
}
