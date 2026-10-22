# JSSATEN Placement Intelligence Hub

## Phase 1

The public placement research portal preserves the original company research interface, routes, search, filters, 22 intelligence sections, and 12 skill cards with 10-level learning roadmaps. The seed files remain in the repository as documented fallback/reference data and are not used in the live data path.

## Phase 2 — Supabase

Hatchable serves the browser app as static files and runs the Supabase data API server-side. Set `SUPABASE_URL` and `SUPABASE_ANON_KEY` in Hatchable's project secrets, then deploy. The browser calls `/api/supabase`; it never receives either credential. For local Vite development, put them in an ignored root `.env.local` file. The API uses the anon key and preserves the database's existing access policies. Do not configure or use a service-role key for this app.

Company cards read only `public.company_json(company_id, short_json)`. Company details read only `public.company_json(company_id, short_json, full_json)` filtered by `company_id`. Skills use only `public.company_skill_levels`, `public.skill_set_master`, `public.proficiency_levels`, and `public.skill_set_topics`; the four small result sets are combined in the browser. The integration is read-only: no writes, schema changes, migrations, auth, or login are added.

The Supabase anon key must have read access to those tables under the database's existing policies. No RLS or permissions are changed by this app. The API only permits the listed read queries and does not accept table or column names from clients.

## Local development note

The original Vite source described in the Phase 2 request is not present in this Hatchable project. Hatchable serves `public/` directly; it does not run npm install, TypeScript compilation, or a Vite build. For the original Vite workflow, use `npm install && npm run dev` in that separate source repository.

## College

Configured college: **JSS Academy of Technical Education** (JSSATEN).