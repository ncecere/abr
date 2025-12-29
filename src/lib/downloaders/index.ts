import { DownloadClientConfig, DownloadClientAdapter } from "@/lib/downloaders/types";
import { NzbgetClient } from "@/lib/downloaders/nzbget";
import { SabnzbdClient } from "@/lib/downloaders/sabnzbd";

export function createDownloadClient(config: DownloadClientConfig): DownloadClientAdapter {
  switch (config.type) {
    case "sabnzbd":
      return new SabnzbdClient(config);
    case "nzbget":
      return new NzbgetClient(config);
    default:
      throw new Error(`Unsupported download client: ${config.type}`);
  }
}
