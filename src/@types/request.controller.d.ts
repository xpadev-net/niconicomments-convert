import type { SaveDialogOptions } from "electron";

import type { Queue } from "@/@types/queue";
import type { ApiRequestLoad } from "@/@types/request.renderer";

export type ApiRequestFromController = {
  host: "controller";
};
export type ApiRequestSelectMovie = {
  type: "selectMovie";
};
export type ApiRequestSelectComment = {
  type: "selectComment";
};
export type ApiRequestSelectOutput = {
  type: "selectOutput";
  options: SaveDialogOptions;
};
export type ApiRequestSelectFile = {
  type: "selectFile";
  pattern: Electron.FileFilter[];
};
export type ApiRequestAppendQueue = {
  type: "appendQueue";
  data: Queue;
};
export type ApiRequestGetSetting = {
  type: "getSetting";
  key: string;
};
export type ApiRequestSetSetting = {
  type: "setSetting";
  key: string;
  data: unknown;
};

export type ApiRequestDownloadMovie = {
  type: "downloadMovie";
  url: string;
  format: string;
  path: string;
};

export type ApiRequestGetAvailableProfiles = {
  type: "getAvailableProfiles";
};

export type ApiRequestGetNiconicoMovieMetadata = {
  type: "getNiconicoMovieMetadata";
  nicoId: string;
};

export type ApiRequestsFromController =
  | ApiRequestAppendQueue
  | ApiRequestSelectComment
  | ApiRequestSelectMovie
  | ApiRequestSelectOutput
  | ApiRequestLoad
  | ApiRequestSelectFile
  | ApiRequestGetSetting
  | ApiRequestSetSetting
  | ApiRequestDownloadMovie
  | ApiRequestGetAvailableProfiles
  | ApiRequestGetNiconicoMovieMetadata;

export {};
