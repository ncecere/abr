"use client";

import { useEffect, useState } from "react";
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
import { Settings, Indexer, Format, DownloadClient, DownloadClientPathMapping } from "@/db/schema";

export type SettingsPanelProps = {
  settings: Settings;
  indexers: Indexer[];
  formats: Format[];
  downloadClients: DownloadClient[];
};

const DEFAULT_EBOOK_CATEGORIES = [7000, 7010, 7020, 7040];

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

type DownloaderDraft = {
  id?: number;
  name: string;
  type: string;
  host: string;
  port: number;
  apiKey?: string;
  username?: string;
  password?: string;
  category: string;
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
  const [selectedMappingClientId, setSelectedMappingClientId] = useState<number | null>(
    initialClients[0]?.id ?? null,
  );
  const [pathMappingsByClient, setPathMappingsByClient] = useState<
    Record<number, DownloadClientPathMapping[]>
  >({});
  const [pathMappingDraft, setPathMappingDraft] = useState({ remotePath: "", localPath: "" });
  const [pathMappingStatus, setPathMappingStatus] = useState<string | null>(null);
  const [pathMappingListStatus, setPathMappingListStatus] = useState<string | null>(null);
  const selectedPathMappings = selectedMappingClientId
    ? pathMappingsByClient[selectedMappingClientId]
    : undefined;
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
  const [isDownloaderModalOpen, setDownloaderModalOpen] = useState(false);
  const [downloaderModalMode, setDownloaderModalMode] = useState<"create" | "edit">("create");
  const [downloaderDraft, setDownloaderDraft] = useState<DownloaderDraft>(() => ({
    name: "",
    type: "sabnzbd",
    host: "http://localhost",
    port: 8080,
    apiKey: "",
    username: "",
    password: "",
    category: "ebooks",
  }));
  const [downloaderModalStatus, setDownloaderModalStatus] = useState<string | null>(null);
  const [downloaderTestStatus, setDownloaderTestStatus] = useState<string | null>(null);
  const [downloaderListStatus, setDownloaderListStatus] = useState<string | null>(null);

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

  const fetchPathMappings = async (clientId: number, silent = false) => {
    if (!silent) {
      setPathMappingListStatus("Loading path mappings…");
    }
    try {
      const response = await fetch(`/api/download-clients/${clientId}/path-mappings`);
      if (!response.ok) {
        const detail = await response.json().catch(() => null);
        throw new Error(detail?.detail ?? "Unable to load path mappings");
      }
      const { data } = await response.json();
      setPathMappingsByClient((prev) => ({ ...prev, [clientId]: data }));
      setPathMappingListStatus(null);
    } catch (error) {
      setPathMappingListStatus(error instanceof Error ? error.message : "Unable to load path mappings");
    }
  };

  useEffect(() => {
    setPathMappingDraft({ remotePath: "", localPath: "" });
    setPathMappingStatus(null);
    if (!selectedMappingClientId) {
      return;
    }
    if (selectedPathMappings) {
      return;
    }
    fetchPathMappings(selectedMappingClientId, true);
  }, [selectedMappingClientId, selectedPathMappings]);

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

  const openCreateDownloaderModal = () => {
    setDownloaderDraft({
      name: "",
      type: "sabnzbd",
      host: "http://localhost",
      port: 8080,
      apiKey: "",
      username: "",
      password: "",
      category: "ebooks",
    });
    setDownloaderModalMode("create");
    setDownloaderModalStatus(null);
    setDownloaderTestStatus(null);
    setDownloaderModalOpen(true);
  };

  const openEditDownloaderModal = (client: DownloadClient) => {
    setDownloaderDraft({
      id: client.id,
      name: client.name,
      type: client.type,
      host: client.host,
      port: client.port,
      apiKey: client.apiKey ?? "",
      username: client.username ?? "",
      password: client.password ?? "",
      category: client.category ?? "ebooks",
    });
    setDownloaderModalMode("edit");
    setDownloaderModalStatus(null);
    setDownloaderTestStatus(null);
    setDownloaderModalOpen(true);
  };

  const closeDownloaderModal = () => {
    setDownloaderModalOpen(false);
  };

  const handleDownloaderDraftChange = (field: keyof DownloaderDraft, value: string) => {
    setDownloaderDraft((prev) => ({
      ...prev,
      [field]: field === "port" ? Number(value) || 0 : value,
    }));
  };

  const handleSaveDownloader = async () => {
    if (!downloaderDraft.name.trim() || !downloaderDraft.host.trim()) {
      setDownloaderModalStatus("Name and host are required");
      return;
    }

    setDownloaderModalStatus(downloaderModalMode === "create" ? "Creating client…" : "Saving client…");
    const payload = {
      name: downloaderDraft.name.trim(),
      type: downloaderDraft.type,
      host: downloaderDraft.host.trim(),
      port: Number.isFinite(downloaderDraft.port) ? downloaderDraft.port : 8080,
      apiKey: downloaderDraft.apiKey?.trim() || undefined,
      username: downloaderDraft.username?.trim() || undefined,
      password: downloaderDraft.password?.trim() || undefined,
      category: downloaderDraft.category.trim() || "ebooks",
      enabled: true,
    };

    try {
      const response = await fetch(
        downloaderDraft.id ? `/api/download-clients/${downloaderDraft.id}` : "/api/download-clients",
        {
          method: downloaderDraft.id ? "PUT" : "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      if (!response.ok) {
        const detail = await response.json().catch(() => null);
        throw new Error(detail?.detail ?? "Request failed");
      }
      const { data } = await response.json();
      setDownloadClients((current) =>
        downloaderDraft.id ? current.map((client) => (client.id === data.id ? data : client)) : [...current, data],
      );
      setDownloaderModalOpen(false);
    } catch (error) {
      setDownloaderModalStatus(error instanceof Error ? error.message : "Failed to save download client");
      return;
    } finally {
      setDownloaderTestStatus(null);
    }
  };

  const handleTestDownloaderDraft = async () => {
    if (!downloaderDraft.host.trim()) {
      setDownloaderTestStatus("Host is required to test");
      return;
    }

    setDownloaderTestStatus("Testing…");
    try {
      const response = await fetch("/api/download-clients/test", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          type: downloaderDraft.type,
          host: downloaderDraft.host.trim(),
          port: Number.isFinite(downloaderDraft.port) ? downloaderDraft.port : 8080,
          apiKey: downloaderDraft.apiKey?.trim() || undefined,
          username: downloaderDraft.username?.trim() || undefined,
          password: downloaderDraft.password?.trim() || undefined,
        }),
      });
      if (!response.ok) {
        const detail = await response.json().catch(() => null);
        throw new Error(detail?.detail ?? "Test failed");
      }
      setDownloaderTestStatus("Connection successful");
    } catch (error) {
      setDownloaderTestStatus(error instanceof Error ? error.message : "Unable to reach download client");
    }
  };

  const handleTestExistingDownloader = async (client: DownloadClient) => {
    setDownloaderListStatus(`Testing ${client.name}…`);
    try {
      const response = await fetch("/api/download-clients/test", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          type: client.type,
          host: client.host,
          port: client.port,
          apiKey: client.apiKey ?? undefined,
          username: client.username ?? undefined,
          password: client.password ?? undefined,
        }),
      });
      if (!response.ok) {
        const detail = await response.json().catch(() => null);
        throw new Error(detail?.detail ?? "Test failed");
      }
      setDownloaderListStatus(`${client.name} responded successfully`);
    } catch (error) {
      setDownloaderListStatus(error instanceof Error ? error.message : "Unable to reach download client");
    }
  };

  const handleDeleteDownloader = async (client: DownloadClient) => {
    try {
      const response = await fetch(`/api/download-clients/${client.id}`, { method: "DELETE" });
      if (!response.ok) {
        const detail = await response.json().catch(() => null);
        throw new Error(detail?.detail ?? "Delete failed");
      }
      setDownloadClients((current) => {
        const next = current.filter((item) => item.id !== client.id);
        if (selectedMappingClientId === client.id) {
          setSelectedMappingClientId(next[0]?.id ?? null);
        }
        return next;
      });
      setPathMappingsByClient((prev) => {
        if (!(client.id in prev)) {
          return prev;
        }
        const next = { ...prev };
        delete next[client.id];
        return next;
      });
      setDownloaderListStatus(`${client.name} deleted`);
    } catch (error) {
      setDownloaderListStatus(error instanceof Error ? error.message : "Failed to delete download client");
    }
  };

  const handlePathMappingDraftChange = (field: keyof typeof pathMappingDraft, value: string) => {
    setPathMappingDraft((prev) => ({ ...prev, [field]: value }));
  };

  const handleAddPathMapping = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedMappingClientId) {
      setPathMappingStatus("Select a download client first");
      return;
    }
    const remotePath = pathMappingDraft.remotePath.trim();
    const localPath = pathMappingDraft.localPath.trim();
    if (!remotePath || !localPath) {
      setPathMappingStatus("Remote and local paths are required");
      return;
    }
    setPathMappingStatus("Saving path mapping…");
    try {
      const response = await fetch(`/api/download-clients/${selectedMappingClientId}/path-mappings`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ remotePath, localPath }),
      });
      if (!response.ok) {
        const detail = await response.json().catch(() => null);
        throw new Error(detail?.detail ?? "Request failed");
      }
      const { data } = await response.json();
      setPathMappingsByClient((prev) => ({
        ...prev,
        [selectedMappingClientId]: [...(prev[selectedMappingClientId] ?? []), data],
      }));
      setPathMappingDraft({ remotePath: "", localPath: "" });
      setPathMappingStatus("Mapping saved");
    } catch (error) {
      setPathMappingStatus(error instanceof Error ? error.message : "Failed to save mapping");
    }
  };

  const handleDeletePathMapping = async (mappingId: number) => {
    if (!selectedMappingClientId) return;
    setPathMappingListStatus("Removing mapping…");
    try {
      const response = await fetch(`/api/download-clients/path-mappings/${mappingId}`, { method: "DELETE" });
      if (!response.ok) {
        const detail = await response.json().catch(() => null);
        throw new Error(detail?.detail ?? "Delete failed");
      }
      setPathMappingsByClient((prev) => ({
        ...prev,
        [selectedMappingClientId]: (prev[selectedMappingClientId] ?? []).filter((mapping) => mapping.id !== mappingId),
      }));
      setPathMappingListStatus(null);
    } catch (error) {
      setPathMappingListStatus(error instanceof Error ? error.message : "Failed to remove mapping");
    }
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
                  value={form.activeDownloaderClientId ? String(form.activeDownloaderClientId) : ""}
                  onValueChange={(value) =>
                    setForm((prev) => ({ ...prev, activeDownloaderClientId: value ? Number(value) : undefined }))
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
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold">Download clients</h3>
              <p className="text-sm text-muted-foreground">Manage SABnzbd or NZBGet endpoints.</p>
            </div>
            <Button onClick={openCreateDownloaderModal}>Add Download Client</Button>
          </div>
          {downloaderListStatus && <p className="text-sm text-muted-foreground">{downloaderListStatus}</p>}
          {downloadClients.length === 0 && (
            <Card>
              <CardContent className="py-6 text-sm text-muted-foreground">No download clients configured.</CardContent>
            </Card>
          )}
          <div className="grid gap-4 md:grid-cols-2">
            {downloadClients.map((client) => (
              <Card key={client.id}>
                <CardHeader className="flex flex-row items-start justify-between gap-3">
                  <div>
                    <CardTitle>{client.name}</CardTitle>
                    <CardDescription>
                      {client.type.toUpperCase()} · {client.host}:{client.port}
                    </CardDescription>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-muted-foreground/20 bg-muted/50 text-muted-foreground transition hover:border-primary/40 hover:text-primary">
                      <MoreHorizontal className="h-4 w-4" />
                      <span className="sr-only">Download client actions</span>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEditDownloaderModal(client)}>Edit</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleTestExistingDownloader(client)}>Test</DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => handleDeleteDownloader(client)} variant="destructive">
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </CardHeader>
                <CardContent className="space-y-1 text-sm text-muted-foreground">
                  <p>Category: {client.category ?? "ebooks"}</p>
                  <p>API key: {client.apiKey ? "••••••••" : "—"}</p>
                </CardContent>
              </Card>
            ))}
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Remote path mappings</CardTitle>
              <CardDescription>Translate downloader paths to local filesystem locations.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {downloadClients.length === 0 ? (
                <p className="text-sm text-muted-foreground">Add a download client to configure path mappings.</p>
              ) : (
                <div className="space-y-4">
                  <div>
                    <Label>Download client</Label>
                    <Select
                      value={selectedMappingClientId ? String(selectedMappingClientId) : ""}
                      onValueChange={(value) => setSelectedMappingClientId(value ? Number(value) : null)}
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
                  {pathMappingListStatus && (
                    <p className="text-sm text-muted-foreground">{pathMappingListStatus}</p>
                  )}
                  <div className="space-y-2">
                    {(selectedPathMappings ?? []).length === 0 ? (
                      <p className="text-sm text-muted-foreground">No path mappings defined.</p>
                    ) : (
                      selectedPathMappings?.map((mapping) => (
                        <div
                          key={mapping.id}
                          className="flex flex-wrap items-center justify-between gap-3 rounded border px-3 py-2 text-sm"
                        >
                          <div>
                            <p className="font-medium">{mapping.remotePath}</p>
                            <p className="text-xs text-muted-foreground">{mapping.localPath}</p>
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeletePathMapping(mapping.id)}
                          >
                            Remove
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                  <form className="grid gap-3 md:grid-cols-2" onSubmit={handleAddPathMapping}>
                    <div>
                      <Label>Remote path</Label>
                      <Input
                        value={pathMappingDraft.remotePath}
                        onChange={(event) => handlePathMappingDraftChange("remotePath", event.target.value)}
                        placeholder="/downloads/incomplete"
                      />
                    </div>
                    <div>
                      <Label>Local path</Label>
                      <Input
                        value={pathMappingDraft.localPath}
                        onChange={(event) => handlePathMappingDraftChange("localPath", event.target.value)}
                        placeholder="/mnt/storage/downloads"
                      />
                    </div>
                    <div className="md:col-span-2 flex flex-wrap items-center gap-3">
                      <Button type="submit" size="sm" disabled={!selectedMappingClientId}>
                        Add Mapping
                      </Button>
                      {pathMappingStatus && <span className="text-sm text-muted-foreground">{pathMappingStatus}</span>}
                    </div>
                  </form>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
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
                    placeholder="7000, 7010, 7020, 7040"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    These categories are combined with the default ebook set 7000/7010/7020/7040 automatically.
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

      {isDownloaderModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-8">
          <div className="w-full max-w-lg rounded-2xl border bg-background p-6 shadow-2xl">
            <div className="mb-4 space-y-1">
              <h3 className="text-xl font-semibold">
                {downloaderModalMode === "create" ? "Add Download Client" : "Edit Download Client"}
              </h3>
              <p className="text-sm text-muted-foreground">
                {downloaderModalStatus ?? "Configure a SABnzbd or NZBGet endpoint."}
              </p>
            </div>
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                handleSaveDownloader();
              }}
            >
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <Label>Name</Label>
                  <Input
                    value={downloaderDraft.name}
                    onChange={(event) => handleDownloaderDraftChange("name", event.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label>Port</Label>
                  <Input
                    type="number"
                    value={downloaderDraft.port}
                    onChange={(event) => handleDownloaderDraftChange("port", event.target.value)}
                  />
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <Label>Type</Label>
                  <Select
                    value={downloaderDraft.type}
                    onValueChange={(value) => handleDownloaderDraftChange("type", value ?? downloaderDraft.type)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sabnzbd">SABnzbd</SelectItem>
                      <SelectItem value="nzbget">NZBGet</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Category</Label>
                  <Input
                    value={downloaderDraft.category}
                    onChange={(event) => handleDownloaderDraftChange("category", event.target.value)}
                  />
                </div>
              </div>
              <div>
                <Label>Host</Label>
                <Input
                  value={downloaderDraft.host}
                  onChange={(event) => handleDownloaderDraftChange("host", event.target.value)}
                  placeholder="http://localhost"
                  required
                />
              </div>
              {downloaderDraft.type === "sabnzbd" && (
                <div>
                  <Label>API key</Label>
                  <Input
                    placeholder="API key"
                    value={downloaderDraft.apiKey ?? ""}
                    onChange={(event) => handleDownloaderDraftChange("apiKey", String(event.target.value ?? ""))}
                  />
                </div>
              )}
              {downloaderDraft.type === "nzbget" && (
                <div>
                  <Label>Username & Password</Label>
                  <div className="grid gap-3 md:grid-cols-2">
                    <Input
                      placeholder="Username"
                      value={downloaderDraft.username ?? ""}
                      onChange={(event) => handleDownloaderDraftChange("username", String(event.target.value ?? ""))}
                    />
                    <Input
                      placeholder="Password"
                      type="password"
                      value={downloaderDraft.password ?? ""}
                      onChange={(event) => handleDownloaderDraftChange("password", String(event.target.value ?? ""))}
                    />
                  </div>
                </div>
              )}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Button type="button" variant="secondary" onClick={handleTestDownloaderDraft}>
                    Test
                  </Button>
                  {downloaderTestStatus && <span className="text-sm text-muted-foreground">{downloaderTestStatus}</span>}
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={closeDownloaderModal}>
                    Cancel
                  </Button>
                  <Button type="submit">
                    {downloaderModalMode === "create" ? "Create" : "Save"}
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
