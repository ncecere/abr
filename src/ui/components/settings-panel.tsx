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
import { maskSecret } from "@/lib/ui/mask";

export type SettingsPanelProps = {
  settings: Settings;
  indexers: Indexer[];
  formats: Format[];
  downloadClients: DownloadClient[];
};

const DEFAULT_AUDIOBOOK_CATEGORIES = [3030, 3035, 3036, 3040];

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

type FormatDraft = {
  id?: number;
  name: string;
  extensions: string;
  priority: number;
  enabled: boolean;
};

type PathMappingDraft = {
  id?: number;
  downloadClientId: number | null;
  remotePath: string;
  localPath: string;
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
  const activeDownloader = form.activeDownloaderClientId
    ? downloadClients.find((client) => client.id === form.activeDownloaderClientId)
    : undefined;
  const [isIndexerModalOpen, setIndexerModalOpen] = useState(false);
  const [selectedMappingClientId, setSelectedMappingClientId] = useState<number | null>(
    initialClients[0]?.id ?? null,
  );
  const [pathMappingsByClient, setPathMappingsByClient] = useState<
    Record<number, DownloadClientPathMapping[]>
  >({});
  const [isFormatModalOpen, setFormatModalOpen] = useState(false);
  const [formatModalMode, setFormatModalMode] = useState<"create" | "edit">("create");
  const [formatDraft, setFormatDraft] = useState<FormatDraft>({
    name: "",
    extensions: "",
    priority: formats.length,
    enabled: true,
  });
  const [formatModalStatus, setFormatModalStatus] = useState<string | null>(null);
  const [formatListStatus, setFormatListStatus] = useState<string | null>(null);
  const [pathMappingListStatus, setPathMappingListStatus] = useState<string | null>(null);
  const [isPathMappingModalOpen, setPathMappingModalOpen] = useState(false);
  const [pathMappingModalMode, setPathMappingModalMode] = useState<"create" | "edit">("create");
  const [pathMappingDraft, setPathMappingDraft] = useState<PathMappingDraft>({
    downloadClientId: selectedMappingClientId ?? downloadClients[0]?.id ?? null,
    remotePath: "",
    localPath: "",
  });
  const [pathMappingModalStatus, setPathMappingModalStatus] = useState<string | null>(null);
  const selectedPathMappings = selectedMappingClientId
    ? pathMappingsByClient[selectedMappingClientId]
    : undefined;
  const selectedMappingClient = selectedMappingClientId
    ? downloadClients.find((client) => client.id === selectedMappingClientId)
    : undefined;
  const [indexerModalMode, setIndexerModalMode] = useState<"create" | "edit">("create");
  const [indexerDraft, setIndexerDraft] = useState<IndexerDraft>(() => ({
    name: "",
    baseUrl: "",
    apiKey: "",
    categories: DEFAULT_AUDIOBOOK_CATEGORIES.join(", "),
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
      category: "audiobooks",

  }));
  const [downloaderModalStatus, setDownloaderModalStatus] = useState<string | null>(null);
  const [downloaderTestStatus, setDownloaderTestStatus] = useState<string | null>(null);
  const [downloaderListStatus, setDownloaderListStatus] = useState<string | null>(null);

  const parseCategoriesInput = (value: string) => {
    const parsed = value
      .split(",")
      .map((entry) => Number(entry.trim()))
      .filter((num) => !Number.isNaN(num) && num > 0);
    return Array.from(new Set([...DEFAULT_AUDIOBOOK_CATEGORIES, ...parsed]));
  };

  const parseStoredCategories = (raw?: string | null) => {
    if (!raw) {
      return [...DEFAULT_AUDIOBOOK_CATEGORIES];
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
    return [...DEFAULT_AUDIOBOOK_CATEGORIES];
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
    if (!selectedMappingClientId) {
      return;
    }
    if (pathMappingsByClient[selectedMappingClientId]) {
      return;
    }
    fetchPathMappings(selectedMappingClientId, true);
  }, [selectedMappingClientId]);

  useEffect(() => {
    setPathMappingDraft((prev) => ({
      ...prev,
      downloadClientId: selectedMappingClientId ?? downloadClients[0]?.id ?? null,
    }));
  }, [selectedMappingClientId, downloadClients]);

  const openCreateIndexerModal = () => {
    setIndexerDraft({
      name: "",
      baseUrl: "",
      apiKey: "",
    categories: DEFAULT_AUDIOBOOK_CATEGORIES.join(", "),

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

  const openCreateFormatModal = () => {
    setFormatDraft({
      id: undefined,
      name: "",
      extensions: "",
      priority: formats.length,
      enabled: true,
    });
    setFormatModalMode("create");
    setFormatModalStatus(null);
    setFormatModalOpen(true);
  };

  const openEditFormatModal = (format: Format) => {
    setFormatDraft({
      id: format.id,
      name: format.name,
      extensions: JSON.parse(format.extensions ?? "[]").join(", "),
      priority: format.priority ?? 0,
      enabled: Boolean(format.enabled),
    });
    setFormatModalMode("edit");
    setFormatModalStatus(null);
    setFormatModalOpen(true);
  };

  const handleFormatDraftChange = (field: keyof FormatDraft, value: string | number | boolean) => {
    setFormatDraft((prev) => ({
      ...prev,
      [field]: field === "priority" ? Number(value) || 0 : value,
    }));
  };

  const handleSaveFormat = async () => {
    if (!formatDraft.name.trim()) {
      setFormatModalStatus("Format name is required");
      return;
    }
    const extensions = formatDraft.extensions
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    if (!extensions.length) {
      setFormatModalStatus("Add at least one extension");
      return;
    }
    setFormatModalStatus(formatModalMode === "create" ? "Creating format…" : "Saving format…");
    const payload = {
      name: formatDraft.name.trim(),
      extensions,
      priority: Number.isFinite(formatDraft.priority) ? formatDraft.priority : formats.length,
      enabled: formatDraft.enabled,
    };
    try {
      const response = await fetch(formatDraft.id ? `/api/formats/${formatDraft.id}` : "/api/formats", {
        method: formatDraft.id ? "PUT" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const detail = await response.json().catch(() => null);
        throw new Error(detail?.detail ?? "Request failed");
      }
      const { data } = await response.json();
      setFormats((current) =>
        (formatDraft.id
          ? current.map((format) => (format.id === data.id ? data : format))
          : [...current, data]
        ).sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0)),
      );
      setFormatModalOpen(false);
    } catch (error) {
      setFormatModalStatus(error instanceof Error ? error.message : "Failed to save format");
    }
  };

  const handleDeleteFormat = async (format: Format) => {
    setFormatListStatus(`Deleting ${format.name}…`);
    try {
      const response = await fetch(`/api/formats/${format.id}`, { method: "DELETE" });
      if (!response.ok) {
        const detail = await response.json().catch(() => null);
        throw new Error(detail?.detail ?? "Delete failed");
      }
      setFormats((current) => current.filter((entry) => entry.id !== format.id));
      setFormatListStatus(`${format.name} deleted`);
    } catch (error) {
      setFormatListStatus(error instanceof Error ? error.message : "Failed to delete format");
    }
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
    category: "audiobooks",

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
      category: client.category ?? "audiobooks",
    });
    setDownloaderModalMode("edit");
    setDownloaderModalStatus(null);
    setDownloaderTestStatus(null);
    setDownloaderModalOpen(true);
  };

  const closeDownloaderModal = () => {
    setDownloaderModalOpen(false);
  };

  const handleDownloaderDraftChange = (
    field: keyof DownloaderDraft,
    value: string | number | boolean | null,
  ) => {
    setDownloaderDraft((prev) => ({
      ...prev,
      [field]:
        field === "port"
          ? Number(value ?? 0) || 0
          : typeof value === "boolean"
            ? value
            : typeof value === "number"
              ? value
              : value ?? "",
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
      category: downloaderDraft.category.trim() || "audiobooks",
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

  const openCreatePathMappingModal = () => {
    setPathMappingDraft({
      id: undefined,
      downloadClientId: selectedMappingClientId ?? downloadClients[0]?.id ?? null,
      remotePath: "",
      localPath: "",
    });
    setPathMappingModalMode("create");
    setPathMappingModalStatus(null);
    setPathMappingModalOpen(true);
  };

  const openEditPathMappingModal = (clientId: number, mapping: DownloadClientPathMapping) => {
    setPathMappingDraft({
      id: mapping.id,
      downloadClientId: clientId,
      remotePath: mapping.remotePath,
      localPath: mapping.localPath,
    });
    setPathMappingModalMode("edit");
    setPathMappingModalStatus(null);
    setPathMappingModalOpen(true);
  };


  const handleSavePathMapping = async () => {
    if (!pathMappingDraft.downloadClientId) {
      setPathMappingModalStatus("Select a download client");
      return;
    }
    const remotePath = pathMappingDraft.remotePath.trim();
    const localPath = pathMappingDraft.localPath.trim();
    if (!remotePath || !localPath) {
      setPathMappingModalStatus("Remote and local paths are required");
      return;
    }
    setPathMappingModalStatus(pathMappingModalMode === "create" ? "Saving path mapping…" : "Updating path mapping…");
    const clientId = pathMappingDraft.downloadClientId;
    const payload = {
      downloadClientId: clientId,
      remotePath,
      localPath,
    };
    try {
      const response = await fetch(
        pathMappingDraft.id
          ? `/api/download-clients/path-mappings/${pathMappingDraft.id}`
          : `/api/download-clients/${clientId}/path-mappings`,
        {
          method: pathMappingDraft.id ? "PUT" : "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      if (!response.ok) {
        const detail = await response.json().catch(() => null);
        throw new Error(detail?.detail ?? "Request failed");
      }
      const { data } = await response.json();
      setPathMappingsByClient((prev) => {
        const next = { ...prev };
        const targetId = data.downloadClientId;
        if (pathMappingDraft.id) {
          for (const key of Object.keys(next)) {
            const numericKey = Number(key);
            if (next[numericKey]?.some((mapping) => mapping.id === data.id)) {
              next[numericKey] = next[numericKey].filter((mapping) => mapping.id !== data.id);
            }
          }
        }
        next[targetId] = [...(next[targetId] ?? []), data];
        return next;
      });
      setPathMappingModalOpen(false);
    } catch (error) {
      setPathMappingModalStatus(error instanceof Error ? error.message : "Failed to save mapping");
    }
  };

  const handleDeletePathMapping = async (clientId: number, mappingId: number) => {
    setPathMappingListStatus("Removing mapping…");
    try {
      const response = await fetch(`/api/download-clients/path-mappings/${mappingId}`, { method: "DELETE" });
      if (!response.ok) {
        const detail = await response.json().catch(() => null);
        throw new Error(detail?.detail ?? "Delete failed");
      }
      setPathMappingsByClient((prev) => ({
        ...prev,
        [clientId]: (prev[clientId] ?? []).filter((mapping) => mapping.id !== mappingId),
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
                    <SelectValue>{activeDownloader?.name ?? "Select a client"}</SelectValue>
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
              <p className="text-sm text-muted-foreground">Manage Newznab-compatible sources for audiobook searches.</p>
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
                    <p className="truncate text-xs">API key: {maskSecret(indexer.apiKey)}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {activeTab === "formats" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold">Formats</h3>
              <p className="text-sm text-muted-foreground">Supported audiobook formats.</p>
            </div>
            <Button onClick={openCreateFormatModal}>Add Format</Button>
          </div>
          {formatListStatus && <p className="text-sm text-muted-foreground">{formatListStatus}</p>}
          {formats.length === 0 ? (
            <Card>
              <CardContent className="py-6 text-sm text-muted-foreground">No formats configured.</CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {formats.map((format) => (
                <Card key={format.id}>
                  <CardHeader className="flex flex-row items-start justify-between gap-3">
                    <div>
                      <CardTitle>{format.name}</CardTitle>
                      <CardDescription>Priority {format.priority ?? 0}</CardDescription>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-muted-foreground/20 bg-muted/50 text-muted-foreground transition hover:border-primary/40 hover:text-primary">
                        <MoreHorizontal className="h-4 w-4" />
                        <span className="sr-only">Format actions</span>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEditFormatModal(format)}>Edit</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => handleDeleteFormat(format)} variant="destructive">
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </CardHeader>
                  <CardContent className="space-y-1 text-sm text-muted-foreground">
                    <p>Extensions: {JSON.parse(format.extensions ?? "[]").join(", ")}</p>
                    <p>Status: {format.enabled ? "Enabled" : "Disabled"}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
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
                  <p>Category: {client.category ?? "audiobooks"}</p>
                  <p>API key: {client.apiKey ? "••••••••" : "—"}</p>
                </CardContent>
              </Card>
            ))}
          </div>
          <Card>
            <CardHeader className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle>Remote path mappings</CardTitle>
                  <CardDescription>Translate downloader paths to local filesystem locations.</CardDescription>
                </div>
                <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                  <Select
                    value={selectedMappingClientId ? String(selectedMappingClientId) : ""}
                    onValueChange={(value) => setSelectedMappingClientId(value ? Number(value) : null)}
                  >
                    <SelectTrigger className="sm:w-64">
                      <SelectValue>{selectedMappingClient?.name ?? "Select a client"}</SelectValue>
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
                  <Button onClick={openCreatePathMappingModal} disabled={!downloadClients.length}>
                    Add Mapping
                  </Button>
                </div>
              </div>
              {pathMappingListStatus && <p className="text-sm text-muted-foreground">{pathMappingListStatus}</p>}
            </CardHeader>
            <CardContent>
              {downloadClients.length === 0 ? (
                <p className="text-sm text-muted-foreground">Add a download client to configure path mappings.</p>
              ) : !selectedMappingClientId ? (
                <p className="text-sm text-muted-foreground">Select a download client to view mappings.</p>
              ) : (selectedPathMappings ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">No path mappings defined for this client.</p>
              ) : (
                <div className="grid gap-3">
                  {selectedPathMappings?.map((mapping) => (
                    <Card key={mapping.id}>
                      <CardHeader className="flex flex-row items-start justify-between gap-3">
                        <div>
                          <CardTitle className="text-base">{mapping.remotePath}</CardTitle>
                          <CardDescription>{mapping.localPath}</CardDescription>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-muted-foreground/20 bg-muted/50 text-muted-foreground transition hover:border-primary/40 hover:text-primary">
                            <MoreHorizontal className="h-4 w-4" />
                            <span className="sr-only">Path mapping actions</span>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEditPathMappingModal(selectedMappingClientId, mapping)}>
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => handleDeletePathMapping(selectedMappingClientId, mapping.id)}
                              variant="destructive"
                            >
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </CardHeader>
                    </Card>
                  ))}
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
                {indexerModalStatus ?? "Provide the details for your audiobook indexer."}
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
                    These categories are combined with the default audiobook set 3030/3035/3036/3040 automatically.
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
                {downloaderModalStatus ?? "Provide the settings for your download client."}
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
                  <Input value={downloaderDraft.name} onChange={(event) => handleDownloaderDraftChange("name", event.target.value)} />
                </div>
                <div>
                  <Label>Type</Label>
                  <Select value={downloaderDraft.type} onValueChange={(value) => handleDownloaderDraftChange("type", value)}>
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
                  <Label>Host</Label>
                  <Input value={downloaderDraft.host} onChange={(event) => handleDownloaderDraftChange("host", event.target.value)} />
                </div>
                <div>
                  <Label>Port</Label>
                  <Input
                    type="number"
                    value={downloaderDraft.port}
                    onChange={(event) => handleDownloaderDraftChange("port", event.target.value)}
                  />
                </div>
                <div>
                  <Label>API key</Label>
                  <Input
                    value={downloaderDraft.apiKey ?? ""}
                    onChange={(event) => handleDownloaderDraftChange("apiKey", event.target.value)}
                  />
                </div>
                <div>
                  <Label>Username</Label>
                  <Input
                    value={downloaderDraft.username ?? ""}
                    onChange={(event) => handleDownloaderDraftChange("username", event.target.value)}
                  />
                </div>
                <div>
                  <Label>Password</Label>
                  <Input
                    type="password"
                    value={downloaderDraft.password ?? ""}
                    onChange={(event) => handleDownloaderDraftChange("password", event.target.value)}
                  />
                </div>
                <div>
                  <Label>Category</Label>
                  <Input
                    value={downloaderDraft.category}
                    onChange={(event) => handleDownloaderDraftChange("category", event.target.value)}
                  />
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Button type="submit">Save</Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => handleTestDownloaderDraft()}
                  disabled={!downloaderDraft.host}
                >
                  Test Connection
                </Button>
                {downloaderModalStatus && <span className="text-sm text-muted-foreground">{downloaderModalStatus}</span>}
                {downloaderTestStatus && <span className="text-sm text-muted-foreground">{downloaderTestStatus}</span>}
              </div>
              <div className="flex justify-end">
                <Button type="button" variant="ghost" onClick={closeDownloaderModal}>
                  Close
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isFormatModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-8">
          <div className="w-full max-w-lg rounded-2xl border bg-background p-6 shadow-2xl">
            <div className="mb-4 space-y-1">
              <h3 className="text-xl font-semibold">
                {formatModalMode === "create" ? "Add Format" : "Edit Format"}
              </h3>
              <p className="text-sm text-muted-foreground">
                {formatModalStatus ?? "Define the audiobook format and extensions."}
              </p>
            </div>
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                handleSaveFormat();
              }}
            >
              <div className="grid gap-3 md:grid-cols-2">
                <div className="md:col-span-2">
                  <Label htmlFor="format-name">Name</Label>
                  <Input
                    id="format-name"
                    value={formatDraft.name}
                    onChange={(event) => handleFormatDraftChange("name", event.target.value)}
                    placeholder="EPUB"
                    required
                  />
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="format-ext">Extensions (comma separated)</Label>
                  <Input
                    id="format-ext"
                    value={formatDraft.extensions}
                    onChange={(event) => handleFormatDraftChange("extensions", event.target.value)}
                    placeholder="epub, mobi"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="format-priority">Priority</Label>
                  <Input
                    id="format-priority"
                    type="number"
                    value={formatDraft.priority}
                    onChange={(event) => handleFormatDraftChange("priority", event.target.value)}
                  />
                </div>
                <div className="flex items-center gap-2 pt-6">
                  <input
                    id="format-enabled"
                    type="checkbox"
                    className="h-4 w-4"
                    checked={formatDraft.enabled}
                    onChange={(event) => handleFormatDraftChange("enabled", event.target.checked)}
                  />
                  <Label htmlFor="format-enabled">Enabled</Label>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={() => setFormatModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">Save</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isPathMappingModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-8">
          <div className="w-full max-w-lg rounded-2xl border bg-background p-6 shadow-2xl">
            <div className="mb-4 space-y-1">
              <h3 className="text-xl font-semibold">
                {pathMappingModalMode === "create" ? "Add Remote Path Mapping" : "Edit Remote Path Mapping"}
              </h3>
              <p className="text-sm text-muted-foreground">
                {pathMappingModalStatus ?? "Map downloader paths to local storage locations."}
              </p>
            </div>
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                handleSavePathMapping();
              }}
            >
              <div>
                <Label>Download client</Label>
                <Select
                  value={pathMappingDraft.downloadClientId ? String(pathMappingDraft.downloadClientId) : ""}
                  onValueChange={(value) =>
                    setPathMappingDraft((prev) => ({
                      ...prev,
                      downloadClientId: value ? Number(value) : null,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue>
                      {pathMappingDraft.downloadClientId
                        ? downloadClients.find((client) => client.id === pathMappingDraft.downloadClientId)?.name ?? "Select a client"
                        : "Select a client"}
                    </SelectValue>
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
              <div>
                <Label>Remote path</Label>
                <Input
                  value={pathMappingDraft.remotePath}
                  onChange={(event) =>
                    setPathMappingDraft((prev) => ({ ...prev, remotePath: event.target.value }))
                  }
                  placeholder="/downloads/complete"
                />
              </div>
              <div>
                <Label>Local path</Label>
                <Input
                  value={pathMappingDraft.localPath}
                  onChange={(event) =>
                    setPathMappingDraft((prev) => ({ ...prev, localPath: event.target.value }))
                  }
                  placeholder="/mnt/storage/downloads"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={() => setPathMappingModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">Save</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
