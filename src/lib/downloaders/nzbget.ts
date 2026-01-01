import { Buffer } from "node:buffer";
import crypto from "node:crypto";
import { DownloadClientAdapter, DownloadClientConfig, DownloadStatusPayload } from "@/lib/downloaders/types";

export class NzbgetClient implements DownloadClientAdapter {
  private readonly endpoint: URL;
  private readonly category: string;
  private readonly authHeader?: string;

  constructor(config: DownloadClientConfig) {
    const host = config.host.startsWith("http") ? config.host : `http://${config.host}`;
    const parsed = new URL(host);
    if (!parsed.port) {
      parsed.port = String(config.port);
    }
    parsed.pathname = "/jsonrpc";
    this.endpoint = parsed;
    this.category = config.category;
    if (config.username && config.password) {
      const token = Buffer.from(`${config.username}:${config.password}`).toString("base64");
      this.authHeader = `Basic ${token}`;
    }
  }

  async enqueue(nzbUrl: string, meta: { title: string; bookId: number }) {
    const response = await this.call("append", [
      `${meta.bookId}-${meta.title}`,
      nzbUrl,
      this.category,
      0,
      false,
      false,
      meta.title,
    ]);
    if (!response) {
      throw new Error("NZBGet failed to enqueue download");
    }
    return String(response) ?? crypto.randomUUID();
  }

  async getStatus(id: string): Promise<DownloadStatusPayload> {
    const queue = (await this.call("listgroups", [])) as any[];
    const queueMatch = queue?.find((group: any) => String(group.NZBID) === id);
    if (queueMatch) {
      const status = queueMatch.Status === "PAUSED" ? "queued" : "downloading";
      return { status };
    }

    const history = (await this.call("history", [])) as any[];
    const historyMatch = history?.find((entry: any) => String(entry.NZBID) === id);
    if (historyMatch) {
      const status = historyMatch.Success ? "completed" : "failed";
      return {
        status,
        outputPath: historyMatch.Storage,
        error: historyMatch.Log?.join("\n"),
      };
    }

    return { status: "queued" };
  }

  async cleanup(_id: string, _options?: { deleteFiles?: boolean }) {
    // NZBGet cleanup is a no-op for now; downloads typically live outside the container
    return;
  }

  private async call(method: string, params: unknown[]) {
    const response = await fetch(this.endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(this.authHeader ? { Authorization: this.authHeader } : {}),
      },
      body: JSON.stringify({ method, params, id: crypto.randomUUID(), version: "1.1" }),
    });
    if (!response.ok) {
      throw new Error(`NZBGet RPC failed: ${response.status}`);
    }
    const payload = (await response.json()) as { result: unknown; error?: unknown };
    if (payload.error) {
      throw new Error(`NZBGet RPC error: ${JSON.stringify(payload.error)}`);
    }
    return payload.result;
  }
}
