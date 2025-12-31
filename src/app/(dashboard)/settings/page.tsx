import { Metadata } from "next";
import { getSettings } from "@/lib/services/settings";
import { listIndexers } from "@/lib/services/indexers";
import { listFormats } from "@/lib/services/formats";
import { listDownloadClients } from "@/lib/services/download-clients";
import { SettingsPanel } from "@/ui/components/settings-panel";

export const metadata: Metadata = {
  title: "ABR · Settings",
};

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const [settings, indexers, formats, downloadClients] = await Promise.all([
    getSettings(),
    listIndexers(),
    listFormats(),
    listDownloadClients(),
  ]);

  if (!settings) {
    throw new Error("Settings not initialized");
  }

  return (
    <section>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-muted-foreground text-sm">Manage configuration, sources, and download clients.</p>
      </div>
      <SettingsPanel
        settings={settings}
        indexers={indexers}
        formats={formats}
        downloadClients={downloadClients}
      />
    </section>
  );
}
