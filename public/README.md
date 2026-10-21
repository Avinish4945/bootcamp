# JSSATEN Placement Intelligence Hub

## Phase 1

This phase is a UI-only placement research portal backed by one hardcoded seed record for Accenture. It does not connect to a database and does not include a Supabase client, migrations, tables, edge functions, or app login. Every in-app route is intended to be directly reachable.

The home screen includes a searchable company card, category filters, and selection persistence through the browser's `localStorage` key `selected-company`. The company workspace contains 22 intelligence sections. Skill Intelligence includes 12 skill cards with 10-level learning roadmaps and target-aware “Beyond scope” rows.

## College

Configured college: **JSS Academy of Technical Education**  
Short tag: **JSSATEN**

## Phase 2 data integration

The seed is isolated in `public/seed.js`; the normalizer functions in `public/app.js` accept raw JSON-shaped objects through `normalizeCompanySummary`, `normalizeCompanyProfile`, and `normalizeDashboardSkills`. In Phase 2, replace the seed read in one data-layer module with rows that expose the same `short_json`, `full_json`, and `skill_levels` shapes, after a Supabase schema and client are deliberately introduced.

## Hatchable runtime note

Hatchable publishes browser-ready static files and does not run a Vite/TypeScript build step or install dependencies during deployment. For that reason, this deployed version uses React 18 UMD, React Router DOM 6 UMD, and htm templates, with the runtime scripts stored under `public/vendor/`. The interface and routes are implemented in plain JavaScript so the hosted artifact is immediately runnable.

A browser smoke checklist is included in `public/smoke-test.html`. Vitest was not added because this hosting project does not execute a package installation or test/build pipeline.