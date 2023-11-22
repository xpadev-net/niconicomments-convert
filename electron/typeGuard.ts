import type {
  ChromiumProfilesJson,
  firefoxContainerDefault,
  firefoxContainersJson,
  firefoxContainerUser,
  ParsedCookie,
} from "@/@types/cookies";
import type {
  CreateSessionResponse,
  TWatchV3Metadata,
  UserData,
  V1AccessRightsHls,
} from "@/@types/niconico";
import type {
  ApiRequestAppendQueue,
  ApiRequestDownloadMovie,
  ApiRequestFromController,
  ApiRequestGetAvailableProfiles,
  ApiRequestGetNiconicoMovieMetadata,
  ApiRequestGetSetting,
  ApiRequestInterruptQueue,
  ApiRequestSelectComment,
  ApiRequestSelectFile,
  ApiRequestSelectMovie,
  ApiRequestSelectOutput,
  ApiRequestSetSetting,
} from "@/@types/request.controller";
import type {
  ApiRequestBuffer,
  ApiRequestEnd,
  ApiRequestFromRenderer,
  ApiRequestLoad,
} from "@/@types/request.renderer";
import type { ApiRequestMessage } from "@/@types/request.renderer";
import type { ApiRequestBlob } from "@/@types/request.renderer";

const typeGuard = {
  controller: {
    selectMovie: (i: unknown): i is ApiRequestSelectMovie =>
      typeof i === "object" &&
      (i as ApiRequestFromController).host === "controller" &&
      (i as ApiRequestSelectMovie).type === "selectMovie",
    selectComment: (i: unknown): i is ApiRequestSelectComment =>
      typeof i === "object" &&
      (i as ApiRequestFromController).host === "controller" &&
      (i as ApiRequestSelectComment).type === "selectComment",
    selectOutput: (i: unknown): i is ApiRequestSelectOutput =>
      typeof i === "object" &&
      (i as ApiRequestFromController).host === "controller" &&
      (i as ApiRequestSelectOutput).type === "selectOutput",
    selectFile: (i: unknown): i is ApiRequestSelectFile =>
      typeof i === "object" &&
      (i as ApiRequestFromController).host === "controller" &&
      (i as ApiRequestSelectFile).type === "selectFile",
    appendQueue: (i: unknown): i is ApiRequestAppendQueue =>
      typeof i === "object" &&
      (i as ApiRequestFromController).host === "controller" &&
      (i as ApiRequestAppendQueue).type === "appendQueue",
    load: (i: unknown): i is ApiRequestLoad =>
      typeof i === "object" &&
      (i as ApiRequestFromController).host === "controller" &&
      (i as ApiRequestLoad).type === "load",
    getSetting: (i: unknown): i is ApiRequestGetSetting =>
      typeof i === "object" &&
      (i as ApiRequestFromController).host === "controller" &&
      (i as ApiRequestGetSetting).type === "getSetting",
    setSetting: (i: unknown): i is ApiRequestSetSetting =>
      typeof i === "object" &&
      (i as ApiRequestFromController).host === "controller" &&
      (i as ApiRequestSetSetting).type === "setSetting",
    downloadMovie: (i: unknown): i is ApiRequestDownloadMovie =>
      typeof i === "object" &&
      (i as ApiRequestFromController).host === "controller" &&
      (i as ApiRequestDownloadMovie).type === "downloadMovie",
    getAvailableProfiles: (i: unknown): i is ApiRequestGetAvailableProfiles =>
      typeof i === "object" &&
      (i as ApiRequestFromController).host === "controller" &&
      (i as ApiRequestGetAvailableProfiles).type === "getAvailableProfiles",
    getNiconicoMovieMetadata: (
      i: unknown,
    ): i is ApiRequestGetNiconicoMovieMetadata =>
      typeof i === "object" &&
      (i as ApiRequestFromController).host === "controller" &&
      (i as ApiRequestGetNiconicoMovieMetadata).type ===
        "getNiconicoMovieMetadata",
    interruptQueue: (i: unknown): i is ApiRequestInterruptQueue =>
      typeof i === "object" &&
      (i as ApiRequestFromController).host === "controller" &&
      (i as ApiRequestInterruptQueue).type === "interruptQueue",
  },
  renderer: {
    buffer: (i: unknown): i is ApiRequestBuffer =>
      typeof i === "object" &&
      (i as ApiRequestFromRenderer).host === "renderer" &&
      (i as ApiRequestBuffer).type === "buffer",
    blob: (i: unknown): i is ApiRequestBlob =>
      typeof i === "object" &&
      (i as ApiRequestFromRenderer).host === "renderer" &&
      (i as ApiRequestBlob).type === "blob",
    end: (i: unknown): i is ApiRequestEnd =>
      typeof i === "object" &&
      (i as ApiRequestFromRenderer).host === "renderer" &&
      (i as ApiRequestEnd).type === "end",
    load: (i: unknown): i is ApiRequestLoad =>
      typeof i === "object" &&
      (i as ApiRequestFromRenderer).host === "renderer" &&
      (i as ApiRequestLoad).type === "load",
    message: (i: unknown): i is ApiRequestMessage =>
      typeof i === "object" &&
      (i as ApiRequestFromRenderer).host === "renderer" &&
      (i as ApiRequestMessage).type === "message",
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
    profiles: (i: unknown): i is ChromiumProfilesJson =>
      typeof i === "object" &&
      typeof (i as ChromiumProfilesJson).profile === "object" &&
      typeof (i as ChromiumProfilesJson).profile.info_cache === "object",
  },
  niconico: {
    userData: (i: unknown): i is UserData =>
      typeof i === "object" &&
      (i as UserData).meta.status === 200 &&
      typeof (i as UserData).data.userId === "string",
    TWatchV3Metadata: (i: unknown): i is TWatchV3Metadata =>
      typeof i === "object" &&
      (i as TWatchV3Metadata).meta.status === 200 &&
      typeof (i as TWatchV3Metadata).data === "object",
    CreateSessionResponse: (i: unknown): i is CreateSessionResponse =>
      typeof i === "object" &&
      ((i as CreateSessionResponse).meta.status === 201 ||
        (i as CreateSessionResponse).meta.status === 200) &&
      ((i as CreateSessionResponse).meta.message === "created" ||
        (i as CreateSessionResponse).meta.message === "ok") &&
      typeof (i as CreateSessionResponse).data === "object",
    v3DMC: (i: unknown): i is TWatchV3Metadata<"dmc"> =>
      typeof i === "object" && !!(i as TWatchV3Metadata).data.media.delivery,
    v3DMS: (i: unknown): i is TWatchV3Metadata<"dms"> =>
      typeof i === "object" && !!(i as TWatchV3Metadata).data.media.domand,
    v1AccessRightsHls: (i: unknown): i is V1AccessRightsHls =>
      typeof i === "object" &&
      (i as V1AccessRightsHls).meta.status === 201 &&
      typeof (i as V1AccessRightsHls).data === "object",
  },
  cookie: {
    parsedCookieKey: (i: unknown): i is keyof ParsedCookie =>
      typeof i === "string" && !!i.match(/expires|Max-Age|path|domain/),
  },
};
export { typeGuard };
