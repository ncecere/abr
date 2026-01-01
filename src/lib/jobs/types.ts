import { JobType } from "@/lib/domain";

export type JobPayloadMap = {
  SEARCH_BOOK: { bookId: number };
  SEARCH_MISSING_BOOKS: Record<string, never>;
  GRAB_RELEASE: { releaseId: number };
  POLL_DOWNLOADS: Record<string, never>;
  IMPORT_DOWNLOAD: { downloadId: number };
  WATCH_DOWNLOAD: { downloadId: number };
};

export type JobPayload<TType extends JobType = JobType> = JobPayloadMap[TType];
