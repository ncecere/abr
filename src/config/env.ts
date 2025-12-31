import path from "node:path";
import { config as loadEnv } from "dotenv";
import { z } from "zod";

loadEnv();

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    DATABASE_PATH: z.string().default("var/data/abr.sqlite"),
    DOWNLOADS_DIR: z.string().default("var/downloads"),
    LIBRARY_ROOT: z.string().optional(),
    SERVICE_NAME: z.string().default("abr"),
    SERVICE_VERSION: z.string().default("0.0.0"),
    DEPLOYMENT_ID: z.string().optional(),
    REGION: z.string().optional(),
    AUDIBLE_CLIENT_ID: z.string().default(""),
    AUDIBLE_CLIENT_SECRET: z.string().default(""),
    AUDIBLE_MARKETPLACE: z.string().default("us"),
    AUDIBLE_LOCALE: z.string().default("en-US"),
    AUDIBLE_REGION: z.string().default("us"),
    AUDIBLE_API_BASE_URL: z.string().url().default("https://api.audible.com"),
    AUDIBLE_TOKEN_URL: z.string().url().default("https://api.audible.com/1.0/oauth2/token"),
    NEWZNAB_REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(10000),
    JOB_CONCURRENCY: z.coerce.number().int().positive().default(3),
    SEARCH_INTERVAL_MINUTES: z.coerce.number().int().positive().default(60),
    DOWNLOAD_POLL_INTERVAL_SECONDS: z.coerce.number().int().positive().default(45),
    WIDE_LOG_SAMPLE_RATE: z.coerce.number().min(0).max(1).default(0.05),
    WIDE_LOG_SLOW_REQUEST_MS: z.coerce.number().int().nonnegative().default(2000),
  })
  .transform((values) => ({
    ...values,
    DATABASE_PATH: path.resolve(values.DATABASE_PATH),
    DOWNLOADS_DIR: path.resolve(values.DOWNLOADS_DIR),
    LIBRARY_ROOT: values.LIBRARY_ROOT ? path.resolve(values.LIBRARY_ROOT) : undefined,
  }));

export type Env = z.infer<typeof envSchema>;

export const env: Env = envSchema.parse(process.env);
