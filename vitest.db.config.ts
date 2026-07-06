import fs from "node:fs";
import path from "node:path";
import { defineConfig } from "vitest/config";

// Muat .env manual (tanpa dependensi dotenv) supaya PrismaClient dapat
// DATABASE_URL saat test DB smoke dijalankan lewat `npm run test:db`.
const envPath = path.resolve(__dirname, ".env");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    const key = m[1];
    let value = m[2];
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.dbtest.ts"],
    // Test menulis & menghapus data lewat DB yang sama — jangan paralel.
    fileParallelism: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "server-only": path.resolve(__dirname, "src/test-stubs/server-only.ts"),
    },
  },
});
