"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Settings, Indexer, Format, DownloadClient } from "@/db/schema";

export type SettingsPanelProps = {
  settings: Settings;
  indexers: Indexer[];
  formats: Format[];
  downloadClients: DownloadClient[];
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

  const handleCreateIndexer = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const payload = {
      name: formData.get("name"),
      baseUrl: formData.get("baseUrl"),
      apiKey: formData.get("apiKey"),
      categories: String(formData.get("categories"))
        .split(",")
        .map((value) => Number(value.trim()))
        .filter(Boolean),
      priority: Number(formData.get("priority")),
      enabled: true,
    };
    const response = await fetch("/api/indexers", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) return;
    const { data } = await response.json();
    setIndexers((current) => [...current, data]);
    event.currentTarget.reset();
  };

  const handleCreateFormat = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
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
    event.currentTarget.reset();
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
    <div className="space-y-8">
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

      <Card>
        <CardHeader>
          <CardTitle>Indexers</CardTitle>
          <CardDescription>Enabled Newznab sources.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ul className="text-sm text-muted-foreground">
            {indexers.map((indexer) => (
              <li key={indexer.id}>
                {indexer.name} · {indexer.baseUrl}
              </li>
            ))}
            {indexers.length === 0 && <li>No indexers configured.</li>}
          </ul>
          <form onSubmit={handleCreateIndexer} className="grid gap-2 md:grid-cols-2">
            <Input name="name" placeholder="Friendly name" required />
            <Input name="baseUrl" placeholder="Base URL" required />
            <Input name="apiKey" placeholder="API key" required />
            <Input name="categories" placeholder="Categories (comma separated)" required />
            <Input name="priority" type="number" placeholder="Priority" defaultValue={indexers.length} required />
            <div className="md:col-span-2">
              <Button type="submit" size="sm">
                Add indexer
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

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
    </div>
  );
}
