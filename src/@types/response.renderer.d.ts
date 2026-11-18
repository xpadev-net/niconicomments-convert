import type { ConvertQueue, ProgressItem, Queue } from "@/@types/queue.js";
import type { ApiResponseEnd } from "@/@types/response.controller.js";

export type ApiResponseToRenderer = {
  target: "renderer";
};
export type ApiResponseProgressRenderer = {
  type: "progress";
  data: Queue;
};
export type ApiResponseLoad = {
  type: "load";
  sessionId: string;
  queue: ConvertQueue;
  commentData: string;
};
export type ApiResponseReportProgress = {
  type: "reportProgress";
  progress: ProgressItem;
};

export type ApiResponsesToRenderer =
  | ApiResponseEnd
  | ApiResponseLoad
  | ApiResponseProgressRenderer
  | ApiResponseReportProgress;
