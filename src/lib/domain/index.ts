export const BOOK_STATES = ["MISSING", "AVAILABLE"] as const;
export type BookState = (typeof BOOK_STATES)[number];

export const ACTIVITY_TYPES = [
  "BOOK_ADDED",
  "RELEASE_FOUND",
  "DOWNLOAD_STARTED",
  "DOWNLOAD_COMPLETED",
  "IMPORT_COMPLETED",
  "BOOK_AVAILABLE",
  "ERROR",
] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export const DOWNLOAD_STATUSES = [
  "queued",
  "downloading",
  "completed",
  "failed",
] as const;
export type DownloadStatus = (typeof DOWNLOAD_STATUSES)[number];

export const JOB_TYPES = [
  "SEARCH_BOOK",
  "SEARCH_MISSING_BOOKS",
  "GRAB_RELEASE",
  "POLL_DOWNLOADS",
  "IMPORT_DOWNLOAD",
  "WATCH_DOWNLOAD",
] as const;
export type JobType = (typeof JOB_TYPES)[number];

export const DOWNLOADER_TYPES = ["sabnzbd", "nzbget"] as const;
export type DownloaderType = (typeof DOWNLOADER_TYPES)[number];
