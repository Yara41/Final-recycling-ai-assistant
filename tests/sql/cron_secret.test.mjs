import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { freshDb, asService, asUser, addUser, one } from './helpers.mjs';

const MIGRATION = new URL('../../supabase/migrations/20261031120050_cron_secret.sql', import.meta.url);
const U = '40000000-0000-4000-8000-00000000000a';

async function dbWithVault() {
  const db = await freshDb({ seed: false });
  // stand-in for Supabase Vault
  await db.exec(`create schema vault;
    create table vault.decrypted_secrets (name text primary key, decrypted_secret text);
    create function vault.create_secret(s text, n text) returns uuid language sql as
      $$ insert into vault.decrypted_secrets values (n, s) returning gen_random_uuid() $$;`);
  await db.exec(await readFile(MIGRATION, 'utf8'));
  return db;
}

test('verify_cron_secret accepts only the vault secret', async () => {
  const db = await dbWithVault();
  const secret = (await one(db, "select decrypted_secret s from vault.decrypted_secrets where name = 'cron_secret'")).s;
  assert.equal(secret.length, 64, 'generated 32 random bytes as hex');
  const yes = await asService(db, (tx) => one(tx, 'select verify_cron_secret($1) v', [secret]));
  const no = await asService(db, (tx) => one(tx, "select verify_cron_secret('guess') v"));
  const empty = await asService(db, (tx) => one(tx, "select verify_cron_secret('') v"));
  assert.deepEqual([yes.v, no.v, empty.v], [true, false, false]);
});

test('only the service role may call verify_cron_secret', async () => {
  const db = await dbWithVault();
  await addUser(db, U);
  await assert.rejects(asUser(db, U, (tx) => tx.query("select verify_cron_secret('x')")), /permission denied/);
});

test('re-running the migration keeps the existing secret', async () => {
  const db = await dbWithVault();
  const before = (await one(db, "select decrypted_secret s from vault.decrypted_secrets where name = 'cron_secret'")).s;
  await db.exec(await readFile(MIGRATION, 'utf8'));
  const after = (await one(db, "select decrypted_secret s from vault.decrypted_secrets where name = 'cron_secret'")).s;
  assert.equal(after, before);
});
