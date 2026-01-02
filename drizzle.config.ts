import { config as loadEnv } from "dotenv";
import { defineConfig } from "drizzle-kit";

loadEnv();

export default defineConfig({
  dialect: "sqlite",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.DATABASE_PATH ?? "var/data/abr.sqlite",
  },
});
