import type { apiResponseDownloadProgress } from "@/@types/response.binaryDownloader";
import type {
  apiResponseEnd,
  apiResponseMessage,
  apiResponseProgress,
  apiResponseSelectComment,
  apiResponseSelectMovie,
  apiResponseStartController,
} from "@/@types/response.controller";
import type { apiResponseStartRender } from "@/@types/response.renderer";

const typeGuard = {
  controller: {
    selectMovie: (i: unknown): i is apiResponseSelectMovie =>
      typeof i === "object" &&
      (i as apiResponseSelectMovie).type === "selectMovie",
    selectComment: (i: unknown): i is apiResponseSelectComment =>
      typeof i === "object" &&
      (i as apiResponseSelectComment).type === "selectComment",
    progress: (i: unknown): i is apiResponseProgress =>
      typeof i === "object" && (i as apiResponseProgress).type === "progress",
    start: (i: unknown): i is apiResponseStartController =>
      typeof i === "object" &&
      (i as apiResponseStartController).type === "start",
    end: (i: unknown): i is apiResponseEnd =>
      typeof i === "object" && (i as apiResponseEnd).type === "end",
    message: (i: unknown): i is apiResponseMessage =>
      typeof i === "object" && (i as apiResponseMessage).type === "message",
  },
  renderer: {
    start: (i: unknown): i is apiResponseStartRender =>
      typeof i === "object" && (i as apiResponseStartRender).type === "start",
    progress: (i: unknown): i is apiResponseProgress =>
      typeof i === "object" && (i as apiResponseProgress).type === "progress",
    end: (i: unknown): i is apiResponseEnd =>
      typeof i === "object" && (i as apiResponseEnd).type === "end",
  },
  binaryDownloader: {
    progress: (i: unknown): i is apiResponseDownloadProgress =>
      typeof i === "object" &&
      (i as apiResponseDownloadProgress).type === "downloadProgress",
  },
};

export { typeGuard };
