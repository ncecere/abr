import path from "node:path";
import { config as loadEnv } from "dotenv";
import { z } from "zod";

loadEnv();

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    DATABASE_PATH: z.string().default("var/data/ebr.sqlite"),
    DOWNLOADS_DIR: z.string().default("var/downloads"),
    LIBRARY_ROOT: z.string().optional(),
    OPEN_LIBRARY_BASE_URL: z.string().url().default("https://openlibrary.org"),
    NEWZNAB_REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(10000),
    JOB_CONCURRENCY: z.coerce.number().int().positive().default(3),
    SEARCH_INTERVAL_MINUTES: z.coerce.number().int().positive().default(60),
    DOWNLOAD_POLL_INTERVAL_SECONDS: z.coerce.number().int().positive().default(45),
  })
  .transform((values) => ({
    ...values,
    DATABASE_PATH: path.resolve(values.DATABASE_PATH),
    DOWNLOADS_DIR: path.resolve(values.DOWNLOADS_DIR),
    LIBRARY_ROOT: values.LIBRARY_ROOT ? path.resolve(values.LIBRARY_ROOT) : undefined,
  }));

export type Env = z.infer<typeof envSchema>;

export const env: Env = envSchema.parse(process.env);
