import { apiRequestLoad } from "@/@types/request.renderer";
import { Queue } from "@/@types/queue";
import SaveDialogOptions = Electron.SaveDialogOptions;

export type apiRequestFromController = {
  host: "controller";
};
export type apiRequestSelectMovie = {
  type: "selectMovie";
};
export type apiRequestSelectComment = {
  type: "selectComment";
};
export type apiRequestSelectOutput = {
  type: "selectOutput";
  options: SaveDialogOptions;
};
export type apiRequestSelectFile = {
  type: "selectFile";
  pattern: Electron.FileFilter[];
};
export type apiRequestAppendQueue = {
  type: "appendQueue";
  data: Queue;
};
export type apiRequestGetSetting = {
  type: "getSetting";
  key: string;
};
export type apiRequestSetSetting = {
  type: "setSetting";
  key: string;
  data: unknown;
};

export type apiRequestGetMovieFormat = {
  type: "getMovieFormat";
  url: string;
};

export type apiRequestDownloadMovie = {
  type: "downloadMovie";
  url: string;
  format: string;
  path: string;
};

export type apiRequestGetAvailableProfiles = {
  type: "getAvailableProfiles";
};

export type apiRequestsFromController =
  | apiRequestAppendQueue
  | apiRequestSelectComment
  | apiRequestSelectMovie
  | apiRequestSelectOutput
  | apiRequestLoad
  | apiRequestSelectFile
  | apiRequestGetSetting
  | apiRequestSetSetting
  | apiRequestGetMovieFormat
  | apiRequestDownloadMovie
  | apiRequestGetAvailableProfiles;

export {};
