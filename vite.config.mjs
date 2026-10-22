import { loadEnv, defineConfig } from "vite";
import { handleSupabaseRequest } from "./api/supabase-core.mjs";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [{
      name: "local-supabase-api",
      configureServer(server) {
        server.middlewares.use("/api/supabase", async (req, res) => {
          if (req.method !== "GET") {
            res.writeHead(405, { "Content-Type": "application/json", "Allow": "GET" });
            res.end(JSON.stringify({ error: "Method not allowed." }));
            return;
          }

          try {
            if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
              res.writeHead(500, { "Content-Type": "application/json" });
              res.end(JSON.stringify({
                error: "Set SUPABASE_URL and SUPABASE_ANON_KEY in the root .env.local file for local development."
              }));
              return;
            }
            const params = new URL(req.url, "http://localhost").searchParams;
            const result = await handleSupabaseRequest(
              Object.fromEntries(params),
              env.SUPABASE_URL,
              env.SUPABASE_ANON_KEY
            );
            res.writeHead(result.status, { "Content-Type": "application/json" });
            res.end(JSON.stringify(result.body));
          } catch (error) {
            server.config.logger.error(error);
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: error.message || "Supabase API request failed." }));
          }
        });
      }
    }]
  };
});
