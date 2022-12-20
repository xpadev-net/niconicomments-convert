import type { inputFormat, inputFormatType } from "@xpadev-net/niconicomments";

import type { Options } from "./options";
import { apiResponseEnd } from "@/@types/response.controller";
import { Queue } from "@/@types/queue";

export type apiResponseToRenderer = {
  target: "renderer";
};
export type apiResponseStartRender = {
  type: "start";
  data: inputFormat;
  format: inputFormatType;
  options?: Options;
  duration: number;
  fps: number;
  offset: number;
  frames: number;
};
export type apiResponseProgressRenderer = {
  type: "progress";
  data: Queue;
};
export type apiResponsesToRenderer =
  | apiResponseEnd
  | apiResponseProgressRenderer
  | apiResponseStartRender;

export {};
