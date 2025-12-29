import { DownloaderType } from "@/lib/domain";

export type DownloadClientConfig = {
  type: DownloaderType;
  host: string;
  port: number;
  apiKey?: string;
  username?: string;
  password?: string;
  category: string;
};

export type DownloadStatusPayload = {
  status: "queued" | "downloading" | "completed" | "failed";
  outputPath?: string;
  error?: string;
};

export interface DownloadClientAdapter {
  enqueue(nzbUrl: string, meta: { title: string; bookId: number }): Promise<string>;
  getStatus(id: string): Promise<DownloadStatusPayload>;
}
