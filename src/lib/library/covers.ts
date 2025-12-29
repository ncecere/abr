import fs from "node:fs/promises";
import path from "node:path";
import { logger } from "@/lib/logger";

const EXTENSION_MAP: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

export async function downloadCoverImage(url: string, directory: string) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download cover: ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const contentType = response.headers.get("content-type") ?? "image/jpeg";
  const extension = EXTENSION_MAP[contentType] ?? ".jpg";
  const coverPath = path.join(directory, `cover${extension}`);
  await fs.writeFile(coverPath, Buffer.from(arrayBuffer));
  logger.debug({ coverPath }, "stored cover image");
  return coverPath;
}
