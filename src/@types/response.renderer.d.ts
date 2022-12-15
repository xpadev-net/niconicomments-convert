import type { inputFormat, inputFormatType } from "@xpadev-net/niconicomments";

import type { Options } from "./options";
import {
  apiResponseEnd,
  apiResponseProgress,
} from "@/@types/response.controller";

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
export type apiResponsesToRenderer =
  | apiResponseEnd
  | apiResponseProgress
  | apiResponseStartRender;

export {};
