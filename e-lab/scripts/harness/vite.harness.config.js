// Dev-server config used ONLY by the headless-browser verify scripts: the
// real app, with src/lib/supabaseClient.js swapped for mock-supabase.js.
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const realClient = path.join(root, "src/lib/supabaseClient.js");
const mock = path.join(here, "mock-supabase.js");

export default defineConfig({
  root,
  plugins: [
    { name: "mock-supabase-client", enforce: "pre", async resolveId(source, importer, opts) {
      if (!/supabaseClient(\.js)?$/.test(source)) return null;
      const r = await this.resolve(source, importer, { ...opts, skipSelf: true });
      return r && path.resolve(r.id) === realClient ? mock : null;
    } },
    react(), tailwindcss(),
  ],
  server: { port: 5301, strictPort: true, host: "127.0.0.1", fs: { allow: [root] } },
});
