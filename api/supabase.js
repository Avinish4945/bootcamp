import { config } from "hatchable";
import { handleSupabaseRequest } from "./supabase-core.mjs";

export const access = "public";

export default async function (req, res) {
  const url = await config.get("SUPABASE_URL");
  const key = await config.get("SUPABASE_ANON_KEY");
  const result = await handleSupabaseRequest(req.query, url, key);
  return res.status(result.status).json(result.body);
}
