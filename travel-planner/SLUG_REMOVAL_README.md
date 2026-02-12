Slug removal and ID-based profile routing
=======================================

Summary
-------
This change removes the legacy username "slug" flow and migrates public profile
URLs to ID-based routing (`/profile/{id}`). The intent is to simplify routing
and avoid maintaining append-only slug history in the application.

What changed
------------
- Added migration: `drizzle/0021_drop_profile_slugs.sql` — archives `profile_slugs`, drops related indexes and the `current_slug` column from `public.profiles` (safe/conditional).
- Replaced slug-based public pages with ID-based pages: `app/profile/[id]/page.tsx`.
- Updated components to use ID-based URLs: `components/AvatarMenu.tsx`, `components/Sidebar.tsx`, `components/groups/GroupMembersList.tsx`.
- Removed or neutralized slug utilities and scripts: `lib/profileLookup.ts` revised for id-based lookup; migration files in `drizzle/` neutralized; scripts `verify_username_display_slug.js` and `check_profiles_username_constraints.js` neutralized.
- Kept `username_display` (case-preserving) for UI; routing and lookups no longer depend on slug fields.
- Tests updated and passing locally.

Safety & rollout
---------------
1. Take a DB backup or export `public.profile_slugs` before applying the migration. The migration will attempt to create `public.profile_slugs_archive` automatically, but an external backup is recommended.
2. Run the migration on staging first and exercise `/profile/{id}` flows and registration.
3. After confirming, run migration in production. The migration includes conditional checks and notices and will not fail if slug artifacts are already absent.

Commands
--------
To push the branch and open a PR (example):

```bash
git checkout -b remove-slug-flow
git add .
git commit -m "chore: remove legacy profile slug flow; add ID-based routing and migration"
git push -u origin remove-slug-flow
# then open PR via your Git host UI
```

Notes
-----
- If you prefer to keep historical slug data outside the DB, export `public.profile_slugs_archive` and remove it from the DB afterward.
- I intentionally neutralized older migrations in the repo to avoid reapplying slug-related DDL during future migrations; the new migration cleans up existing DB artifacts.
