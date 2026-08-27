import { defineConfig } from "drizzle-kit";
import { env } from "@/lib/env";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema/index.ts",
  out: "./drizzle",
  dbCredentials: {
    url: env.DATABASE_URL,
  },
  casing: "snake_case",
});
