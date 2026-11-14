import type { SaveDialogOptions } from "electron";

import type { UUID } from "@/@types/brand";
import type { Queue } from "@/@types/queue";
import type { AppSettings } from "@/@types/setting";

export type ApiRequestFromController = {
  host: "controller";
};
export type ApiRequestSelectMovie = {
  type: "selectMovie";
};
export type ApiRequestDropFiles = {
  type: "dropFiles";
  paths: string[];
};
export type ApiRequestSelectComment = {
  type: "selectComment";
};
export type ApiRequestSelectOutput = {
  type: "selectOutput";
  options: Pick<
    SaveDialogOptions,
    "title" | "defaultPath" | "filters" | "properties"
  >;
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
  [K in keyof AppSettings]: { type: "getSetting"; key: K };
}[keyof AppSettings];
export type ApiRequestSetSetting = {
  [K in keyof AppSettings]: {
    type: "setSetting";
    key: K;
    data: AppSettings[K];
  };
}[keyof AppSettings];

export type ApiRequestGetAvailableProfiles = {
  type: "getAvailableProfiles";
};

export type ApiRequestGetNiconicoMovieMetadata = {
  type: "getNiconicoMovieMetadata";
  nicoId: string;
};

export type ApiRequestInterruptQueue = {
  type: "interruptQueue";
  queueId: UUID;
};

export type ApiRequestGetQueue = {
  type: "getQueue";
};

export type ApiRequestsFromController =
  | ApiRequestAppendQueue
  | ApiRequestSelectComment
  | ApiRequestSelectMovie
  | ApiRequestDropFiles
  | ApiRequestSelectOutput
  | ApiRequestSelectFile
  | ApiRequestGetSetting
  | ApiRequestSetSetting
  | ApiRequestGetAvailableProfiles
  | ApiRequestGetNiconicoMovieMetadata
  | ApiRequestInterruptQueue
  | ApiRequestGetQueue;
