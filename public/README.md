# JSSATEN Placement Intelligence Hub

## Phase 1

The public placement research portal preserves the original company research interface, routes, search, filters, 22 intelligence sections, and 12 skill cards with 10-level learning roadmaps. The seed files remain in the repository as documented fallback/reference data and are not used in the live data path.

## Phase 2 — Supabase

This hosted Hatchable version uses the browser UMD build of @supabase/supabase-js because Hatchable serves static browser-ready files and does not run a Vite build or npm install during deployment. Paste the Supabase project URL and anon/public key into `public/supabase-config.js` (`url` and `anonKey`), then redeploy. This is the only manual configuration step. Never put a service-role key in browser code.

Company cards read only `public.company_json(company_id, short_json)`. Company details read only `public.company_json(company_id, short_json, full_json)` filtered by `company_id`. Skills use only `public.company_skill_levels`, `public.skill_set_master`, `public.proficiency_levels`, and `public.skill_set_topics`; the four small result sets are combined in the browser. The integration is read-only: no writes, schema changes, migrations, auth, or login are added.

The client expects the Supabase anon key to have read access to those tables under the database's existing policies. No RLS or permissions are changed by this app.

## Local development note

The original Vite source described in the Phase 2 request is not present in this Hatchable project. Hatchable serves `public/` directly; it does not run npm install, TypeScript compilation, or a Vite build. For the original Vite workflow, use `npm install && npm run dev` in that separate source repository.

## College

Configured college: **JSS Academy of Technical Education** (JSSATEN).