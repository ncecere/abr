import crypto from "node:crypto";
import { DownloadClientAdapter, DownloadClientConfig, DownloadStatusPayload } from "@/lib/downloaders/types";

export class SabnzbdClient implements DownloadClientAdapter {
  private readonly baseUrl: string;
  private readonly category: string;
  private readonly apiKey?: string;

  constructor(config: DownloadClientConfig) {
    const host = config.host.startsWith("http") ? config.host : `http://${config.host}`;
    const parsed = new URL(host);
    if (!parsed.port) {
      parsed.port = String(config.port);
    }
    this.baseUrl = parsed.toString().replace(/\/$/, "");
    this.category = config.category;
    this.apiKey = config.apiKey;
  }

  async enqueue(nzbUrl: string, meta: { title: string; bookId: number }) {
    const url = new URL("/api", this.baseUrl);
    url.searchParams.set("mode", "addurl");
    url.searchParams.set("name", nzbUrl);
    url.searchParams.set("cat", this.category);
    url.searchParams.set("nzbname", `${meta.bookId}-${meta.title}`);
    url.searchParams.set("output", "json");
    if (this.apiKey) {
      url.searchParams.set("apikey", this.apiKey);
    }

    const response = await fetch(url.toString());
    const data = (await response.json()) as { status: boolean; nzo_ids?: string[] };
    if (!response.ok || !data.status) {
      throw new Error("SABnzbd failed to enqueue");
    }
    return data.nzo_ids?.[0] ?? crypto.randomUUID();
  }

  async getStatus(id: string): Promise<DownloadStatusPayload> {
    const queue = await this.fetchQueue();
    const slot = queue.queue?.slots?.find((entry: any) => entry.nzo_id === id);
    if (slot) {
      return {
        status: slot.status === "Completed" ? "completed" : "downloading",
      };
    }

    const historyItem = await this.findHistoryItem(id);
    if (historyItem) {
      const status = historyItem.status === "Completed" ? "completed" : "failed";
      return {
        status,
        outputPath: historyItem.storage,
        error: historyItem.fail_message,
      };
    }

    return { status: "queued" };
  }

  private async fetchQueue() {
    return this.request({ mode: "queue", start: "0", limit: "50" });
  }

  private async findHistoryItem(id: string) {
    const pageSize = 100;
    const maxPages = 5;
    for (let page = 0; page < maxPages; page++) {
      const start = page * pageSize;
      const history = await this.request({ mode: "history", start: String(start), limit: String(pageSize) });
      const slots = history.history?.slots ?? [];
      const match = slots.find((entry: any) => entry.nzo_id === id);
      if (match) {
        return match;
      }
      if (slots.length < pageSize) {
        break;
      }
    }
    return undefined;
  }

  async cleanup(id: string, options?: { deleteFiles?: boolean }) {
    const url = new URL("/api", this.baseUrl);
    url.searchParams.set("mode", "history");
    url.searchParams.set("name", "delete");
    url.searchParams.set("value", id);
    url.searchParams.set("del_files", options?.deleteFiles ? "1" : "0");
    url.searchParams.set("output", "json");
    if (this.apiKey) {
      url.searchParams.set("apikey", this.apiKey);
    }
    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(`SABnzbd cleanup failed (${response.status})`);
    }
    const payload = (await response.json()) as { status?: boolean };
    if (payload?.status === false) {
      throw new Error("SABnzbd cleanup rejected request");
    }
  }

  private async request(params: Record<string, string>) {
    const url = new URL("/api", this.baseUrl);
    Object.entries({ ...params, output: "json" }).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });
    if (this.apiKey) {
      url.searchParams.set("apikey", this.apiKey);
    }

    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error("Unable to communicate with SABnzbd");
    }
    return (await response.json()) as any;
  }
}
