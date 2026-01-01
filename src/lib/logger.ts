import pino from "pino";
import { env } from "@/config";

const rawLogLevel = (process.env.LOG_LEVEL ?? "").trim().toLowerCase();
const level = rawLogLevel || (env.NODE_ENV === "production" ? "info" : "debug");

export const logger = pino({
  level,
  base: undefined,
});
