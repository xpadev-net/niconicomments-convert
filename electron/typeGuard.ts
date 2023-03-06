import type {
  apiRequestSelectMovie,
  apiRequestFromController,
  apiRequestSelectComment,
  apiRequestSelectOutput,
  apiRequestSelectFile,
  apiRequestGetSetting,
  apiRequestSetSetting,
  apiRequestGetMovieFormat,
  apiRequestDownloadMovie,
  apiRequestAppendQueue,
  apiRequestGetAvailableProfiles,
  apiRequestGetNiconicoMovieMetadata,
} from "@/@types/request.controller";
import type {
  apiRequestLoad,
  apiRequestProgress,
  apiRequestFromRenderer,
  apiRequestBuffer,
  apiRequestEnd,
} from "@/@types/request.renderer";
import {
  chromiumProfilesJson,
  firefoxContainerDefault,
  firefoxContainersJson,
  firefoxContainerUser,
} from "@/@types/cookies";
import { createSessionResponse, watchV3Metadata } from "@/@types/niconico";

const typeGuard = {
  controller: {
    selectMovie: (i: unknown): i is apiRequestSelectMovie =>
      typeof i === "object" &&
      (i as apiRequestFromController).host === "controller" &&
      (i as apiRequestSelectMovie).type === "selectMovie",
    selectComment: (i: unknown): i is apiRequestSelectComment =>
      typeof i === "object" &&
      (i as apiRequestFromController).host === "controller" &&
      (i as apiRequestSelectComment).type === "selectComment",
    selectOutput: (i: unknown): i is apiRequestSelectOutput =>
      typeof i === "object" &&
      (i as apiRequestFromController).host === "controller" &&
      (i as apiRequestSelectOutput).type === "selectOutput",
    selectFile: (i: unknown): i is apiRequestSelectFile =>
      typeof i === "object" &&
      (i as apiRequestFromController).host === "controller" &&
      (i as apiRequestSelectFile).type === "selectFile",
    appendQueue: (i: unknown): i is apiRequestAppendQueue =>
      typeof i === "object" &&
      (i as apiRequestFromController).host === "controller" &&
      (i as apiRequestAppendQueue).type === "appendQueue",
    load: (i: unknown): i is apiRequestLoad =>
      typeof i === "object" &&
      (i as apiRequestFromController).host === "controller" &&
      (i as apiRequestLoad).type === "load",
    getSetting: (i: unknown): i is apiRequestGetSetting =>
      typeof i === "object" &&
      (i as apiRequestFromController).host === "controller" &&
      (i as apiRequestGetSetting).type === "getSetting",
    setSetting: (i: unknown): i is apiRequestSetSetting =>
      typeof i === "object" &&
      (i as apiRequestFromController).host === "controller" &&
      (i as apiRequestSetSetting).type === "setSetting",
    getMovieFormat: (i: unknown): i is apiRequestGetMovieFormat =>
      typeof i === "object" &&
      (i as apiRequestFromController).host === "controller" &&
      (i as apiRequestGetMovieFormat).type === "getMovieFormat",
    downloadMovie: (i: unknown): i is apiRequestDownloadMovie =>
      typeof i === "object" &&
      (i as apiRequestFromController).host === "controller" &&
      (i as apiRequestDownloadMovie).type === "downloadMovie",
    getAvailableProfiles: (i: unknown): i is apiRequestGetAvailableProfiles =>
      typeof i === "object" &&
      (i as apiRequestFromController).host === "controller" &&
      (i as apiRequestGetAvailableProfiles).type === "getAvailableProfiles",
    getNiconicoMovieMetadata: (
      i: unknown
    ): i is apiRequestGetNiconicoMovieMetadata =>
      typeof i === "object" &&
      (i as apiRequestFromController).host === "controller" &&
      (i as apiRequestGetNiconicoMovieMetadata).type ===
        "getNiconicoMovieMetadata",
  },
  renderer: {
    progress: (i: unknown): i is apiRequestProgress =>
      typeof i === "object" &&
      (i as apiRequestFromRenderer).host === "renderer" &&
      (i as apiRequestProgress).type === "progress",
    buffer: (i: unknown): i is apiRequestBuffer =>
      typeof i === "object" &&
      (i as apiRequestFromRenderer).host === "renderer" &&
      (i as apiRequestBuffer).type === "buffer",
    end: (i: unknown): i is apiRequestEnd =>
      typeof i === "object" &&
      (i as apiRequestFromRenderer).host === "renderer" &&
      (i as apiRequestEnd).type === "end",
    load: (i: unknown): i is apiRequestLoad =>
      typeof i === "object" &&
      (i as apiRequestFromRenderer).host === "renderer" &&
      (i as apiRequestLoad).type === "load",
  },
  firefox: {
    containers: (i: unknown): i is firefoxContainersJson =>
      typeof i === "object" &&
      (i as firefoxContainersJson).version === 4 &&
      Array.isArray((i as firefoxContainersJson).identities),
    defaultContainer: (i: unknown): i is firefoxContainerDefault =>
      typeof i === "object" &&
      typeof (i as firefoxContainerDefault).l10nID === "string",
    userContainer: (i: unknown): i is firefoxContainerUser =>
      typeof i === "object" &&
      typeof (i as firefoxContainerUser).name === "string",
  },
  chromium: {
    profiles: (i: unknown): i is chromiumProfilesJson =>
      typeof i === "object" &&
      typeof (i as chromiumProfilesJson).profile === "object" &&
      typeof (i as chromiumProfilesJson).profile.info_cache === "object",
  },
  niconico: {
    watchV3Metadata: (i: unknown): i is watchV3Metadata =>
      typeof i === "object" &&
      (i as watchV3Metadata).meta.status === 200 &&
      typeof (i as watchV3Metadata).data === "object",
    createSessionResponse: (i: unknown): i is createSessionResponse =>
      typeof i === "object" &&
      ((i as createSessionResponse).meta.status === 201 ||
        (i as createSessionResponse).meta.status === 200) &&
      ((i as createSessionResponse).meta.message === "created" ||
        (i as createSessionResponse).meta.message === "ok") &&
      typeof (i as createSessionResponse).data === "object",
  },
};
export { typeGuard };
