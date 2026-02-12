-- Migration: 0011_profiles_username_not_null_ci.sql
-- Make profiles.username NOT NULL and add a case-insensitive unique index on lower(username)
-- Safe migration: normalize NULLs, deduplicate case-insensitively, then add index and NOT NULL.

DO $$
DECLARE
  rec RECORD;
  ids uuid[];
BEGIN
  -- 1) Fill NULL usernames from users.username when available
  UPDATE public.profiles p
  SET username = u.username
  FROM public.users u
  WHERE p.username IS NULL AND u.id = p.id AND u.username IS NOT NULL;

  -- 2) For remaining NULL usernames, try to use local part of users.email (lowercased)
  UPDATE public.profiles p
  SET username = lower(split_part(u.email, '@', 1))
  FROM public.users u
  WHERE p.username IS NULL AND u.id = p.id AND u.email IS NOT NULL;

  -- 3) For any still NULL, generate a stable fallback 'user_' + first 8 chars of uuid
  UPDATE public.profiles
  SET username = ('user_' || substring(id::text,1,8))
  WHERE username IS NULL;

  -- 4) Normalize duplicates that collide case-insensitively
  FOR rec IN
    SELECT lower(username) AS uname, array_agg(id ORDER BY id) AS ids, count(*) AS cnt
    FROM public.profiles
    WHERE username IS NOT NULL
    GROUP BY lower(username)
    HAVING count(*) > 1
  LOOP
    -- keep first id, modify others by appending '_' + first8(id)
    ids := rec.ids;
    FOR i IN 2 .. array_length(ids,1) LOOP
      UPDATE public.profiles
      SET username = username || '_' || substring((ids[i])::text,1,8)
      WHERE id = ids[i];
    END LOOP;
  END LOOP;

  -- 5) Trim surrounding whitespace but preserve original casing
  UPDATE public.profiles
  SET username = trim(username)
  WHERE username IS NOT NULL;

  -- 6) Ensure no case-insensitive duplicates remain (raise if any still exist)
  IF EXISTS (
    SELECT 1 FROM (
      SELECT lower(username) AS lu, count(*) AS c
      FROM public.profiles
      GROUP BY lower(username)
      HAVING count(*) > 1
    ) t
  ) THEN
    RAISE EXCEPTION 'Case-insensitive duplicates remain in profiles.username; manual review required';
  END IF;

  -- 7) Create case-insensitive unique index on lower(username)
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_indexes WHERE schemaname = 'public' AND tablename = 'profiles' AND indexname = 'idx_profiles_username_ci'
  ) THEN
    EXECUTE 'CREATE UNIQUE INDEX idx_profiles_username_ci ON public.profiles (lower(username));';
  END IF;

  -- 8) Finally set NOT NULL (will succeed now that username is populated)
  ALTER TABLE public.profiles ALTER COLUMN username SET NOT NULL;

  RAISE NOTICE '0011_profiles_username_not_null_ci applied';
END$$;
