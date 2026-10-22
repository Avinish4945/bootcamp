# JSSATEN Placement Intelligence Hub

[![Deploy to Hatchable](https://hatchable.com/deploy-button.svg)](https://hatchable.com/deploy?repo=https://github.com/Avinish4945/bootcamp)

Public company research and placement analytics portal for JSS Academy of Technical Education. The browser app reads company and skills data through a Hatchable server-side API. Supabase credentials are stored in Hatchable project secrets and are not included in public assets.

This folder is a complete Hatchable project. The `api/` directory contains the server-side data route, and `hatchable.toml` declares the secrets it uses.

## Supabase secrets

Set `SUPABASE_URL` and `SUPABASE_ANON_KEY` in the Hatchable project Setup page before deploying. Use the anon key, not a service-role key; the API uses the existing Supabase policies for read access. Secret values are managed in Hatchable and must not be committed to this repository.

For local Vite development, put those same values in an ignored `.env.local` file at the project root. The Vite-only API middleware reads them server-side; it does not expose them through `import.meta.env` or browser assets.

## Run your own copy

1. Go to https://hatchable.com/deploy
2. Bring this folder as a .zip, or point the importer at a Git repository that contains it
3. Your copy gets its own database, its own URL, and connects to your own keys

## About Hatchable

Hatchable is where AI-built apps go live. Connect the AI you already use and it can build, deploy, and run apps like this one for you.

Built on Hatchable. https://hatchable.com
