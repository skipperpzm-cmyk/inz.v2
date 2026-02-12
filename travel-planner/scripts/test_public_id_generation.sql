-- Test script for `public.generate_public_id` and `profiles.public_id` behavior.
-- These are manual/test steps to run in a staging DB to verify behavior and concurrency safety.

-- 1) Simple insert test: ensure new profile row gets a public_id
-- Run in psql (connected to your app DB):
-- BEGIN; 
-- INSERT INTO public.profiles (id, username, username_display, created_at) VALUES ('test-pid-1', 'testuser', 'testuser', now());
-- SELECT id, public_id, username_display FROM public.profiles WHERE id = 'test-pid-1';
-- ROLLBACK; -- use ROLLBACK if you don't want to persist test rows

-- 2) Concurrency smoke test (manual):
-- Open two psql sessions (Terminal A and B).
-- In Terminal A:
-- BEGIN;
-- INSERT INTO public.profiles (id, username, username_display, created_at) VALUES ('test-pid-2', 'racea', 'racea', now());
-- -- do NOT COMMIT yet; sleep to simulate long transaction:
-- SELECT pg_sleep(2);
-- COMMIT;

-- In Terminal B (started roughly simultaneously):
-- BEGIN;
-- INSERT INTO public.profiles (id, username, username_display, created_at) VALUES ('test-pid-3', 'raceb', 'raceb', now());
-- COMMIT;

-- After both commits, verify that both rows have unique `public_id` values and are 8-digit numeric strings:
-- SELECT id, public_id FROM public.profiles WHERE id IN ('test-pid-2','test-pid-3');

-- 3) Verify uniqueness and NOT NULL constraint:
-- SELECT count(*) FROM public.profiles WHERE public_id IS NULL; -- expect 0
-- SELECT count(public_id), count(DISTINCT public_id) FROM public.profiles; -- expect equal counts

-- 4) Clean up test rows if persisted:
-- DELETE FROM public.profiles WHERE id LIKE 'test-pid-%';

-- Notes:
-- - The migration uses an advisory lock; the concurrency test above helps verify new parallel inserts don't collide.
-- - For heavier stress testing, use a small script or pgbench-based workload spawning many parallel clients performing inserts.
