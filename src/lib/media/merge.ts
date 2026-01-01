import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

function escapeForManifest(value: string) {
  return value.replace(/'/g, "'\\''");
}

export async function mergeTracksWithFfmpeg(files: string[], outputPath: string) {
  if (!files.length) {
    throw new Error("No tracks provided for merging");
  }
  await fs.mkdir(path.dirname(outputPath), { recursive: true });

  const manifestPath = path.join(path.dirname(outputPath), `.abr-merge-${Date.now()}.txt`);
  const manifestContents = files.map((file) => `file '${escapeForManifest(file)}'`).join("\n");
  await fs.writeFile(manifestPath, manifestContents, "utf8");

  try {
    await runFfmpeg([
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      manifestPath,
      "-c",
      "copy",
      outputPath,
    ]);
  } finally {
    await fs.unlink(manifestPath).catch(() => {});
  }
}

function runFfmpeg(args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn("ffmpeg", args, { stdio: ["ignore", "inherit", "inherit"] });
    child.on("error", (error) => reject(error));
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`ffmpeg exited with code ${code}`));
      }
    });
  });
}
