import type { SaveDialogOptions } from "electron";

import type { UUID } from "@/@types/brand";
import type { Queue } from "@/@types/queue";
import type { Settings } from "@/@types/setting";

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
  [K in keyof Settings]: { type: "getSetting"; key: K };
}[keyof Settings];
export type ApiRequestSetSetting = {
  [K in keyof Settings]: { type: "setSetting"; key: K; data: Settings[K] };
}[keyof Settings];

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
