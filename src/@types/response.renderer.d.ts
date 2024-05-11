import type { ConvertQueue, Queue } from "@/@types/queue";
import type { ApiResponseEnd } from "@/@types/response.controller";

export type ApiResponseToRenderer = {
  target: "renderer";
};
export type ApiResponseProgressRenderer = {
  type: "progress";
  data: Queue;
};
export type ApiResponseLoad = {
  type: "load";
  queue: ConvertQueue;
  commentData: string;
};
export type ApiResponseReportProgress = {
  type: "reportProgress";
  converted: number;
};

export type ApiResponsesToRenderer =
  | ApiResponseEnd
  | ApiResponseLoad
  | ApiResponseProgressRenderer
  | ApiResponseReportProgress;
