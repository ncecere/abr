"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal } from "lucide-react";
import { Settings, Indexer, Format, DownloadClient } from "@/db/schema";

export type SettingsPanelProps = {
  settings: Settings;
  indexers: Indexer[];
  formats: Format[];
  downloadClients: DownloadClient[];
};

const DEFAULT_EBOOK_CATEGORIES = [8000, 8010, 8020, 8040];

const tabs = [
  { key: "server", label: "Server" },
  { key: "indexers", label: "Indexers" },
  { key: "formats", label: "Formats" },
  { key: "downloaders", label: "Download Clients" },
] as const;

type TabKey = (typeof tabs)[number]["key"];

type IndexerDraft = {
  id?: number;
  name: string;
  baseUrl: string;
  apiKey: string;
  categories: string;
  priority: number;
};

export function SettingsPanel({ settings, indexers: initialIndexers, formats: initialFormats, downloadClients: initialClients }: SettingsPanelProps) {
  const [form, setForm] = useState({
    serverPort: settings.serverPort,
    libraryRoot: settings.libraryRoot,
    searchIntervalMinutes: settings.searchIntervalMinutes,
    activeDownloaderClientId: settings.activeDownloaderClientId ?? undefined,
  });
  const [indexers, setIndexers] = useState(initialIndexers);
  const [formats, setFormats] = useState(initialFormats);
  const [downloadClients, setDownloadClients] = useState(initialClients);
  const [status, setStatus] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("server");
  const [isIndexerModalOpen, setIndexerModalOpen] = useState(false);
  const [indexerModalMode, setIndexerModalMode] = useState<"create" | "edit">("create");
  const [indexerDraft, setIndexerDraft] = useState<IndexerDraft>(() => ({
    name: "",
    baseUrl: "",
    apiKey: "",
    categories: DEFAULT_EBOOK_CATEGORIES.join(", "),
    priority: initialIndexers.length,
  }));
  const [indexerModalStatus, setIndexerModalStatus] = useState<string | null>(null);
  const [indexerTestStatus, setIndexerTestStatus] = useState<string | null>(null);
  const [indexerListStatus, setIndexerListStatus] = useState<string | null>(null);

  const parseCategoriesInput = (value: string) => {
    const parsed = value
      .split(",")
      .map((entry) => Number(entry.trim()))
      .filter((num) => !Number.isNaN(num) && num > 0);
    return Array.from(new Set([...DEFAULT_EBOOK_CATEGORIES, ...parsed]));
  };

  const parseStoredCategories = (raw?: string | null) => {
    if (!raw) {
      return [...DEFAULT_EBOOK_CATEGORIES];
    }
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.map((num) => Number(num)).filter((num) => !Number.isNaN(num) && num > 0);
      }
    } catch {
      // ignore
    }
    if (typeof raw === "string") {
      return parseCategoriesInput(raw);
    }
    return [...DEFAULT_EBOOK_CATEGORIES];
  };

  const openCreateIndexerModal = () => {
    setIndexerDraft({
      name: "",
      baseUrl: "",
      apiKey: "",
      categories: DEFAULT_EBOOK_CATEGORIES.join(", "),
      priority: indexers.length,
    });
    setIndexerModalMode("create");
    setIndexerModalStatus(null);
    setIndexerTestStatus(null);
    setIndexerModalOpen(true);
  };

  const openEditIndexerModal = (indexer: Indexer) => {
    const categories = parseStoredCategories(indexer.categories);
    setIndexerDraft({
      id: indexer.id,
      name: indexer.name,
      baseUrl: indexer.baseUrl,
      apiKey: indexer.apiKey,
      categories: categories.join(", "),
      priority: indexer.priority ?? 0,
    });
    setIndexerModalMode("edit");
    setIndexerModalStatus(null);
    setIndexerTestStatus(null);
    setIndexerModalOpen(true);
  };

  const closeIndexerModal = () => {
    setIndexerModalOpen(false);
  };

  const handleIndexerDraftChange = (field: keyof IndexerDraft, value: string) => {
    setIndexerDraft((prev) => ({
      ...prev,
      [field]: field === "priority" ? Number(value) || 0 : value,
    }));
  };

  const handleSaveIndexer = async () => {
    if (!indexerDraft.name.trim() || !indexerDraft.baseUrl.trim() || !indexerDraft.apiKey.trim()) {
      setIndexerModalStatus("Name, URL, and API key are required");
      return;
    }

    setIndexerModalStatus(indexerModalMode === "create" ? "Creating indexer…" : "Saving indexer…");
    const payload = {
      name: indexerDraft.name.trim(),
      baseUrl: indexerDraft.baseUrl.trim(),
      apiKey: indexerDraft.apiKey.trim(),
      categories: parseCategoriesInput(indexerDraft.categories),
      priority: Number.isFinite(indexerDraft.priority) ? indexerDraft.priority : 0,
      enabled: true,
    };

    try {
      const response = await fetch(indexerDraft.id ? `/api/indexers/${indexerDraft.id}` : "/api/indexers", {
        method: indexerDraft.id ? "PUT" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const detail = await response.json().catch(() => null);
        throw new Error(detail?.detail ?? "Request failed");
      }
      const { data } = await response.json();
      setIndexers((current) =>
        indexerDraft.id ? current.map((idx) => (idx.id === data.id ? data : idx)) : [...current, data],
      );
      setIndexerModalOpen(false);
    } catch (error) {
      setIndexerModalStatus(error instanceof Error ? error.message : "Failed to save indexer");
      return;
    } finally {
      setIndexerTestStatus(null);
    }
  };

  const handleTestIndexerDraft = async () => {
    if (!indexerDraft.baseUrl.trim() || !indexerDraft.apiKey.trim()) {
      setIndexerTestStatus("Base URL and API key required to test");
      return;
    }

    setIndexerTestStatus("Testing…");
    try {
      const response = await fetch("/api/indexers/test", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          baseUrl: indexerDraft.baseUrl.trim(),
          apiKey: indexerDraft.apiKey.trim(),
          categories: parseCategoriesInput(indexerDraft.categories),
        }),
      });
      if (!response.ok) {
        const detail = await response.json().catch(() => null);
        throw new Error(detail?.detail ?? "Test failed");
      }
      setIndexerTestStatus("Connection successful");
    } catch (error) {
      setIndexerTestStatus(error instanceof Error ? error.message : "Unable to reach indexer");
    }
  };

  const handleTestExistingIndexer = async (indexer: Indexer) => {
    setIndexerListStatus(`Testing ${indexer.name}…`);
    try {
      const response = await fetch("/api/indexers/test", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          baseUrl: indexer.baseUrl,
          apiKey: indexer.apiKey,
          categories: parseStoredCategories(indexer.categories),
        }),
      });
      if (!response.ok) {
        const detail = await response.json().catch(() => null);
        throw new Error(detail?.detail ?? "Test failed");
      }
      setIndexerListStatus(`${indexer.name} responded successfully`);
    } catch (error) {
      setIndexerListStatus(error instanceof Error ? error.message : "Unable to reach indexer");
    }
  };

  const handleDeleteIndexer = async (indexer: Indexer) => {
    try {
      const response = await fetch(`/api/indexers/${indexer.id}`, { method: "DELETE" });
      if (!response.ok) {
        const detail = await response.json().catch(() => null);
        throw new Error(detail?.detail ?? "Delete failed");
      }
      setIndexers((current) => current.filter((item) => item.id !== indexer.id));
      setIndexerListStatus(`${indexer.name} deleted`);
    } catch (error) {
      setIndexerListStatus(error instanceof Error ? error.message : "Failed to delete indexer");
    }
  };

  const handleSettingsSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setStatus("Saving settings…");
    const response = await fetch("/api/settings", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(form),
    });
    setStatus(response.ok ? "Settings saved" : "Failed to save settings");
  };

  const handleCreateFormat = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    const formData = new FormData(formElement);
    const payload = {
      name: formData.get("name"),
      extensions: String(formData.get("extensions"))
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
      priority: Number(formData.get("priority")),
      enabled: true,
    };
    const response = await fetch("/api/formats", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) return;
    const { data } = await response.json();
    setFormats((current) => [...current, data]);
    formElement.reset();
  };

  const handleCreateDownloadClient = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const payload = {
      name: formData.get("name"),
      type: formData.get("type"),
      host: formData.get("host"),
      port: Number(formData.get("port")),
      apiKey: formData.get("apiKey") || undefined,
      username: formData.get("username") || undefined,
      password: formData.get("password") || undefined,
      category: formData.get("category") || "ebooks",
      enabled: true,
    };
    const response = await fetch("/api/download-clients", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) return;
    const { data } = await response.json();
    setDownloadClients((current) => [...current, data]);
    event.currentTarget.reset();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`rounded-full border px-4 py-1 text-sm transition ${
              activeTab === tab.key
                ? "border-primary bg-primary/10 text-primary"
                : "border-muted-foreground/30 text-muted-foreground hover:border-primary/50"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "server" && (
        <Card>
          <CardHeader>
            <CardTitle>Server</CardTitle>
            <CardDescription>Control runtime behavior and directories.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSettingsSubmit} className="grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="port">Port</Label>
                <Input
                  id="port"
                  type="number"
                  value={form.serverPort}
                  onChange={(event) => setForm((prev) => ({ ...prev, serverPort: Number(event.target.value) }))}
                />
              </div>
              <div>
                <Label htmlFor="libraryRoot">Library root</Label>
                <Input
                  id="libraryRoot"
                  value={form.libraryRoot}
                  onChange={(event) => setForm((prev) => ({ ...prev, libraryRoot: event.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="interval">Search interval (minutes)</Label>
                <Input
                  id="interval"
                  type="number"
                  value={form.searchIntervalMinutes}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, searchIntervalMinutes: Number(event.target.value) }))
                  }
                />
              </div>
              <div>
                <Label>Active download client</Label>
                <Select
                  value={form.activeDownloaderClientId ? String(form.activeDownloaderClientId) : undefined}
                  onValueChange={(value) =>
                    setForm((prev) => ({ ...prev, activeDownloaderClientId: Number(value) }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {downloadClients.map((client) => (
                        <SelectItem key={client.id} value={String(client.id)}>
                          {client.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-2 flex items-center gap-4">
                <Button type="submit">Save</Button>
                {status && <span className="text-sm text-muted-foreground">{status}</span>}
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {activeTab === "indexers" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold">Indexers</h3>
              <p className="text-sm text-muted-foreground">Manage Newznab-compatible sources for ebook searches.</p>
            </div>
            <Button onClick={openCreateIndexerModal}>Add Indexer</Button>
          </div>
          {indexerListStatus && <p className="text-sm text-muted-foreground">{indexerListStatus}</p>}
          {indexers.length === 0 && (
            <Card>
              <CardContent className="py-6 text-sm text-muted-foreground">No indexers configured yet.</CardContent>
            </Card>
          )}
          <div className="grid gap-4 md:grid-cols-2">
            {indexers.map((indexer) => {
              const categories = parseStoredCategories(indexer.categories);
              return (
                <Card key={indexer.id}>
                  <CardHeader className="flex flex-row items-start justify-between gap-3">
                    <div>
                      <CardTitle>{indexer.name}</CardTitle>
                      <CardDescription>{indexer.baseUrl}</CardDescription>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-muted-foreground/20 bg-muted/50 text-muted-foreground transition hover:border-primary/40 hover:text-primary">
                        <MoreHorizontal className="h-4 w-4" />
                        <span className="sr-only">Indexer actions</span>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEditIndexerModal(indexer)}>Edit</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleTestExistingIndexer(indexer)}>Test</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => handleDeleteIndexer(indexer)} variant="destructive">
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </CardHeader>
                  <CardContent className="space-y-1 text-sm text-muted-foreground">
                    <p>
                      Categories: {categories.length ? categories.join(", ") : "None"}
                    </p>
                    <p>Priority: {indexer.priority ?? 0}</p>
                    <p className="truncate text-xs">API key: {indexer.apiKey}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {activeTab === "formats" && (
        <Card>
          <CardHeader>
            <CardTitle>Formats</CardTitle>
            <CardDescription>Supported ebook extensions.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="text-sm text-muted-foreground">
              {formats.map((format) => (
                <li key={format.id}>
                  {format.name} · {JSON.parse(format.extensions).join(", ")} (priority {format.priority})
                </li>
              ))}
            </ul>
            <form onSubmit={handleCreateFormat} className="grid gap-2 md:grid-cols-2">
              <Input name="name" placeholder="Format name" required />
              <Input name="extensions" placeholder="Extensions (comma separated)" required />
              <Input name="priority" type="number" placeholder="Priority" defaultValue={formats.length} required />
              <div className="md:col-span-2">
                <Button type="submit" size="sm">
                  Add format
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {activeTab === "downloaders" && (
        <Card>
          <CardHeader>
            <CardTitle>Download clients</CardTitle>
            <CardDescription>SABnzbd or NZBGet endpoints.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="text-sm text-muted-foreground">
              {downloadClients.map((client) => (
                <li key={client.id}>
                  {client.name} · {client.type} · {client.host}:{client.port}
                </li>
              ))}
            </ul>
            <form onSubmit={handleCreateDownloadClient} className="grid gap-2 md:grid-cols-2">
              <Input name="name" placeholder="Client name" required />
              <Select name="type" defaultValue="sabnzbd">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sabnzbd">SABnzbd</SelectItem>
                  <SelectItem value="nzbget">NZBGet</SelectItem>
                </SelectContent>
              </Select>
              <Input name="host" placeholder="Host" required />
              <Input name="port" type="number" placeholder="Port" required defaultValue={8080} />
              <Input name="apiKey" placeholder="API key (SABnzbd)" />
              <Input name="username" placeholder="Username (NZBGet)" />
              <Input name="password" placeholder="Password (NZBGet)" />
              <Input name="category" placeholder="Category" defaultValue="ebooks" />
              <div className="md:col-span-2">
                <Button type="submit" size="sm">
                  Add client
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {isIndexerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-8">
          <div className="w-full max-w-lg rounded-2xl border bg-background p-6 shadow-2xl">
            <div className="mb-4 space-y-1">
              <h3 className="text-xl font-semibold">
                {indexerModalMode === "create" ? "Add Indexer" : "Edit Indexer"}
              </h3>
              <p className="text-sm text-muted-foreground">
                {indexerModalStatus ?? "Provide the details for your ebook indexer."}
              </p>
            </div>
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                handleSaveIndexer();
              }}
            >
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <Label>Name</Label>
                  <Input
                    value={indexerDraft.name}
                    onChange={(event) => handleIndexerDraftChange("name", event.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label>Priority</Label>
                  <Input
                    type="number"
                    value={indexerDraft.priority}
                    onChange={(event) => handleIndexerDraftChange("priority", event.target.value)}
                  />
                </div>
              </div>
              <div>
                <Label>Base URL</Label>
                <Input
                  value={indexerDraft.baseUrl}
                  onChange={(event) => handleIndexerDraftChange("baseUrl", event.target.value)}
                  placeholder="https://indexer.example.com"
                  required
                />
              </div>
              <div>
                <Label>API key</Label>
                <Input
                  value={indexerDraft.apiKey}
                  onChange={(event) => handleIndexerDraftChange("apiKey", event.target.value)}
                  required
                />
              </div>
              <div>
                <Label>Categories</Label>
                <Input
                  value={indexerDraft.categories}
                  onChange={(event) => handleIndexerDraftChange("categories", event.target.value)}
                  placeholder="8000, 8010, 8020, 8040"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  These categories are combined with the default ebook set 8000/8010/8020/8040 automatically.
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleTestIndexerDraft}
                    disabled={!indexerDraft.baseUrl.trim() || !indexerDraft.apiKey.trim()}
                  >
                    Test
                  </Button>
                  {indexerTestStatus && <span className="text-sm text-muted-foreground">{indexerTestStatus}</span>}
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={closeIndexerModal}>
                    Cancel
                  </Button>
                  <Button type="submit">
                    {indexerModalMode === "create" ? "Create" : "Save"}
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
