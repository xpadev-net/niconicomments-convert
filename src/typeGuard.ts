import type { ApiResponseDownloadProgress } from "@/@types/response.binaryDownloader";
import type {
  ApiResponseEnd,
  ApiResponseMessage,
  ApiResponseProgress,
  ApiResponseSelectComment,
  ApiResponseSelectMovie,
  ApiResponseStartController,
} from "@/@types/response.controller";
import type { ApiResponseReportProgress } from "@/@types/response.renderer";

const typeGuard = {
  controller: {
    selectMovie: (i: unknown): i is ApiResponseSelectMovie =>
      typeof i === "object" &&
      (i as ApiResponseSelectMovie).type === "selectMovie",
    selectComment: (i: unknown): i is ApiResponseSelectComment =>
      typeof i === "object" &&
      (i as ApiResponseSelectComment).type === "selectComment",
    progress: (i: unknown): i is ApiResponseProgress =>
      typeof i === "object" && (i as ApiResponseProgress).type === "progress",
    start: (i: unknown): i is ApiResponseStartController =>
      typeof i === "object" &&
      (i as ApiResponseStartController).type === "start",
    end: (i: unknown): i is ApiResponseEnd =>
      typeof i === "object" && (i as ApiResponseEnd).type === "end",
    message: (i: unknown): i is ApiResponseMessage =>
      typeof i === "object" && (i as ApiResponseMessage).type === "message",
  },
  renderer: {
    progress: (i: unknown): i is ApiResponseProgress =>
      typeof i === "object" && (i as ApiResponseProgress).type === "progress",
    end: (i: unknown): i is ApiResponseEnd =>
      typeof i === "object" && (i as ApiResponseEnd).type === "end",
    reportProgress: (i: unknown): i is ApiResponseReportProgress =>
      typeof i === "object" &&
      (i as ApiResponseReportProgress).type === "reportProgress",
  },
  binaryDownloader: {
    progress: (i: unknown): i is ApiResponseDownloadProgress =>
      typeof i === "object" &&
      (i as ApiResponseDownloadProgress).type === "downloadProgress",
  },
};

export { typeGuard };
