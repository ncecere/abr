import { z } from "zod";
import { DOWNLOADER_TYPES } from "@/lib/domain";

export const settingsUpdateSchema = z.object({
  serverPort: z.number().int().min(1).max(65535),
  libraryRoot: z.string().min(1),
  searchIntervalMinutes: z.number().int().min(5).max(24 * 60),
  activeDownloaderClientId: z.number().int().positive().nullable(),
});

export const securitySettingsSchema = z.object({
  authEnabled: z.boolean(),
  username: z.string().min(1).optional(),
  password: z.string().min(8).optional(),
});

export const indexerPayloadSchema = z.object({
  name: z.string().min(1),
  baseUrl: z.string().url(),
  apiKey: z.string().min(1),
  categories: z.array(z.number().int().positive()).min(1),
  enabled: z.boolean().default(true),
  priority: z.number().int().min(0).default(0),
});

export const formatPayloadSchema = z.object({
  name: z.string().min(1),
  extensions: z.array(z.string().min(1)).min(1),
  enabled: z.boolean().default(true),
  priority: z.number().int().min(0).default(0),
});

export const downloadClientPayloadSchema = z.object({
  name: z.string().min(1),
  type: z.enum(DOWNLOADER_TYPES),
  host: z.string().min(1),
  port: z.number().int().positive(),
  apiKey: z.string().optional(),
  username: z.string().optional(),
  password: z.string().optional(),
  category: z.string().min(1).default("audiobooks"),
  enabled: z.boolean().default(true),
});

export const downloadClientPathMappingSchema = z.object({
  downloadClientId: z.number().int().positive().optional(),
  remotePath: z.string().min(1),
  localPath: z.string().min(1),
});

export const addBookSchema = z.object({
  asin: z.string().min(1),
  productId: z.string().min(1).optional(),
});

export type SettingsUpdateInput = z.infer<typeof settingsUpdateSchema>;
export type SecuritySettingsInput = z.infer<typeof securitySettingsSchema>;
export type IndexerInput = z.infer<typeof indexerPayloadSchema>;
export type FormatInput = z.infer<typeof formatPayloadSchema>;
export type DownloadClientInput = z.infer<typeof downloadClientPayloadSchema>;
export type DownloadClientPathMappingInput = z.infer<typeof downloadClientPathMappingSchema>;
export type AddBookInput = z.infer<typeof addBookSchema>;
