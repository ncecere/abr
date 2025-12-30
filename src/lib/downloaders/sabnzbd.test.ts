import { beforeEach, describe, expect, it, vi } from "vitest";
import { SabnzbdClient } from "@/lib/downloaders/sabnzbd";

const fetchMock = vi.fn();

vi.stubGlobal("fetch", fetchMock);

describe("SabnzbdClient", () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it("enqueues NZBs and returns SAB ID", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ status: true, nzo_ids: ["SAB-1"] }) });
    const client = new SabnzbdClient({
      type: "sabnzbd",
      host: "http://localhost",
      port: 8080,
      apiKey: "abc",
      category: "audiobooks",
    });
    const id = await client.enqueue("https://example/nzb", { title: "Book", bookId: 1 });
    expect(id).toBe("SAB-1");
  });

  it("reads queue status before history fallback", async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ queue: { slots: [{ nzo_id: "abc", status: "Downloading" }] } }),
      })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ history: { slots: [] } }) });

    const client = new SabnzbdClient({
      type: "sabnzbd",
      host: "http://localhost",
      port: 8080,
      apiKey: "abc",
      category: "audiobooks",
    });
    const status = await client.getStatus("abc");
    expect(status.status).toBe("downloading");
  });
});
