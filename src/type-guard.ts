import type { V3MetadataBody } from "@/@types/niconico";
import type { ApiResponseDownloadProgress } from "@/@types/response.binary-downloader";
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
    v3DMC: (i: unknown): i is V3MetadataBody<"dmc"> =>
      typeof i === "object" &&
      i !== null &&
      "media" in (i as V3MetadataBody) &&
      !!(i as V3MetadataBody).media.delivery,
    v3DMS: (i: unknown): i is V3MetadataBody<"dms"> =>
      typeof i === "object" &&
      i !== null &&
      "media" in (i as V3MetadataBody) &&
      !!(i as V3MetadataBody).media.domand,
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
