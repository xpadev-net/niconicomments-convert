import { z } from "zod";

import type {
  ChromiumProfilesJson,
  firefoxContainerDefault,
  firefoxContainersJson,
  ParsedCookie,
} from "@/@types/cookies";
import type {
  CreateSessionResponse,
  TWatchV3Metadata,
  UserData,
  V1AccessRightsHls,
  V3MetadataBody,
  WatchPageMetadata,
} from "@/@types/niconico";
import type {
  ApiRequestAppendQueue,
  ApiRequestDownloadMovie,
  ApiRequestDropFiles,
  ApiRequestGetAvailableProfiles,
  ApiRequestGetNiconicoMovieMetadata,
  ApiRequestGetQueue,
  ApiRequestGetSetting,
  ApiRequestInterruptQueue,
  ApiRequestSelectComment,
  ApiRequestSelectFile,
  ApiRequestSelectMovie,
  ApiRequestSelectOutput,
  ApiRequestSetSetting,
} from "@/@types/request.controller";
import type {
  ApiRequestBlob,
  ApiRequestBuffer,
  ApiRequestEnd,
  ApiRequestLoad,
  ApiRequestMessage,
} from "@/@types/request.renderer";

// Controller schemas
const controllerSelectMovieSchema = z.object({
  host: z.literal("controller"),
  type: z.literal("selectMovie"),
});

const controllerSelectCommentSchema = z.object({
  host: z.literal("controller"),
  type: z.literal("selectComment"),
});

const controllerSelectOutputSchema = z.object({
  host: z.literal("controller"),
  type: z.literal("selectOutput"),
  options: z.object({}).passthrough(), // SaveDialogOptions型。より具体的なスキーマを推奨します
});

const controllerSelectFileSchema = z.object({
  host: z.literal("controller"),
  type: z.literal("selectFile"),
  pattern: z.any(), // FileFilter[]型
});

const controllerDropFilesSchema = z.object({
  host: z.literal("controller"),
  type: z.literal("dropFiles"),
  paths: z.array(z.string()),
});

const controllerAppendQueueSchema = z.object({
  host: z.literal("controller"),
  type: z.literal("appendQueue"),
  data: z.any(), // Queue型
});

const controllerLoadSchema = z.object({
  host: z.literal("controller"),
  type: z.literal("load"),
});

const controllerGetSettingSchema = z.object({
  host: z.literal("controller"),
  type: z.literal("getSetting"),
  key: z.string(),
});

const controllerSetSettingSchema = z.object({
  host: z.literal("controller"),
  type: z.literal("setSetting"),
  key: z.string(),
  data: z.unknown(),
});

const controllerDownloadMovieSchema = z.object({
  host: z.literal("controller"),
  type: z.literal("downloadMovie"),
  url: z.string(),
  format: z.string(),
  path: z.string(),
});

const controllerGetAvailableProfilesSchema = z.object({
  host: z.literal("controller"),
  type: z.literal("getAvailableProfiles"),
});

const controllerGetNiconicoMovieMetadataSchema = z.object({
  host: z.literal("controller"),
  type: z.literal("getNiconicoMovieMetadata"),
  nicoId: z.string(),
});

const controllerInterruptQueueSchema = z.object({
  host: z.literal("controller"),
  type: z.literal("interruptQueue"),
  queueId: z.string().uuid(), // UUID型
});

const controllerGetQueueSchema = z.object({
  host: z.literal("controller"),
  type: z.literal("getQueue"),
});

// Renderer schemas
const rendererBufferSchema = z.object({
  host: z.literal("renderer"),
  type: z.literal("buffer"),
  data: z.array(z.string()),
});

const rendererBlobSchema = z.object({
  host: z.literal("renderer"),
  type: z.literal("blob"),
  frameId: z.number(),
  data: z.instanceof(Uint8Array),
});

const rendererEndSchema = z.object({
  host: z.literal("renderer"),
  type: z.literal("end"),
  frameId: z.number(),
});

const rendererLoadSchema = z.object({
  host: z.literal("renderer"),
  type: z.literal("load"),
});

const rendererMessageSchema = z.object({
  host: z.literal("renderer"),
  type: z.literal("message"),
  title: z.string().optional(),
  message: z.string(),
});

// Firefox schemas
const firefoxContainersSchema = z.object({
  version: z.literal(4),
  identities: z.array(z.any()),
});

const firefoxDefaultContainerSchema = z.object({
  l10nID: z.string(),
});

// Chromium schemas
const chromiumProfilesSchema = z.object({
  profile: z.object({
    info_cache: z.any(),
  }),
});

// Niconico schemas
const niconicoUserDataSchema = z.object({
  meta: z.object({
    status: z.literal(200),
  }),
  data: z.object({
    userId: z.string(),
  }),
});

const niconicoTWatchV3MetadataSchema = z.object({
  meta: z.object({
    status: z.literal(200),
  }),
  data: z.any(),
});

const niconicoWatchPageJsonSchema = z.object({
  meta: z.object({
    status: z.literal(200),
  }),
  data: z.object({
    response: z.any(),
  }),
});

const niconicoCreateSessionResponseSchema = z.object({
  meta: z.object({
    status: z.union([z.literal(201), z.literal(200)]),
    message: z.union([z.literal("created"), z.literal("ok")]),
  }),
  data: z.any(),
});

const niconicoV3DMCSchema = z.object({
  media: z.object({
    delivery: z.any(),
  }),
});

const niconicoV3DMSSchema = z.object({
  media: z.object({
    domand: z.any(),
  }),
});

const niconicoV1AccessRightsHlsSchema = z.object({
  meta: z.object({
    status: z.literal(201),
  }),
  data: z.any(),
});

// Cookie schemas
const parsedCookieKeySchema = z.string().regex(/expires|Max-Age|path|domain/);

const typeGuard = {
  controller: {
    selectMovie: (i: unknown): i is ApiRequestSelectMovie =>
      typeof i === "object" &&
      i !== null &&
      controllerSelectMovieSchema.safeParse(i).success,
    selectComment: (i: unknown): i is ApiRequestSelectComment =>
      typeof i === "object" &&
      i !== null &&
      controllerSelectCommentSchema.safeParse(i).success,
    selectOutput: (i: unknown): i is ApiRequestSelectOutput =>
      typeof i === "object" &&
      i !== null &&
      controllerSelectOutputSchema.safeParse(i).success,
    selectFile: (i: unknown): i is ApiRequestSelectFile =>
      typeof i === "object" &&
      i !== null &&
      controllerSelectFileSchema.safeParse(i).success,
    dropFiles: (i: unknown): i is ApiRequestDropFiles =>
      typeof i === "object" &&
      i !== null &&
      controllerDropFilesSchema.safeParse(i).success,
    appendQueue: (i: unknown): i is ApiRequestAppendQueue =>
      typeof i === "object" &&
      i !== null &&
      controllerAppendQueueSchema.safeParse(i).success,
    load: (i: unknown): i is ApiRequestLoad =>
      typeof i === "object" &&
      i !== null &&
      controllerLoadSchema.safeParse(i).success,
    getSetting: (i: unknown): i is ApiRequestGetSetting =>
      typeof i === "object" &&
      i !== null &&
      controllerGetSettingSchema.safeParse(i).success,
    setSetting: (i: unknown): i is ApiRequestSetSetting =>
      typeof i === "object" &&
      i !== null &&
      controllerSetSettingSchema.safeParse(i).success,
    downloadMovie: (i: unknown): i is ApiRequestDownloadMovie =>
      typeof i === "object" &&
      i !== null &&
      controllerDownloadMovieSchema.safeParse(i).success,
    getAvailableProfiles: (i: unknown): i is ApiRequestGetAvailableProfiles =>
      typeof i === "object" &&
      i !== null &&
      controllerGetAvailableProfilesSchema.safeParse(i).success,
    getNiconicoMovieMetadata: (
      i: unknown,
    ): i is ApiRequestGetNiconicoMovieMetadata =>
      typeof i === "object" &&
      i !== null &&
      controllerGetNiconicoMovieMetadataSchema.safeParse(i).success,
    interruptQueue: (i: unknown): i is ApiRequestInterruptQueue =>
      typeof i === "object" &&
      i !== null &&
      controllerInterruptQueueSchema.safeParse(i).success,
    getQueue: (i: unknown): i is ApiRequestGetQueue =>
      typeof i === "object" &&
      i !== null &&
      controllerGetQueueSchema.safeParse(i).success,
  },
  renderer: {
    buffer: (i: unknown): i is ApiRequestBuffer =>
      typeof i === "object" &&
      i !== null &&
      rendererBufferSchema.safeParse(i).success,
    blob: (i: unknown): i is ApiRequestBlob =>
      typeof i === "object" &&
      i !== null &&
      rendererBlobSchema.safeParse(i).success,
    end: (i: unknown): i is ApiRequestEnd =>
      typeof i === "object" &&
      i !== null &&
      rendererEndSchema.safeParse(i).success,
    load: (i: unknown): i is ApiRequestLoad =>
      typeof i === "object" &&
      i !== null &&
      rendererLoadSchema.safeParse(i).success,
    message: (i: unknown): i is ApiRequestMessage =>
      typeof i === "object" &&
      i !== null &&
      rendererMessageSchema.safeParse(i).success,
  },
  firefox: {
    containers: (i: unknown): i is firefoxContainersJson =>
      typeof i === "object" &&
      i !== null &&
      firefoxContainersSchema.safeParse(i).success,
    defaultContainer: (i: unknown): i is firefoxContainerDefault =>
      typeof i === "object" &&
      i !== null &&
      firefoxDefaultContainerSchema.safeParse(i).success,
  },
  chromium: {
    profiles: (i: unknown): i is ChromiumProfilesJson =>
      typeof i === "object" &&
      i !== null &&
      chromiumProfilesSchema.safeParse(i).success,
  },
  niconico: {
    userData: (i: unknown): i is UserData =>
      typeof i === "object" &&
      i !== null &&
      niconicoUserDataSchema.safeParse(i).success,
    TWatchV3Metadata: (i: unknown): i is TWatchV3Metadata =>
      typeof i === "object" &&
      i !== null &&
      niconicoTWatchV3MetadataSchema.safeParse(i).success,
    WatchPageJson: (i: unknown): i is WatchPageMetadata =>
      typeof i === "object" &&
      i !== null &&
      niconicoWatchPageJsonSchema.safeParse(i).success,
    CreateSessionResponse: (i: unknown): i is CreateSessionResponse =>
      typeof i === "object" &&
      i !== null &&
      niconicoCreateSessionResponseSchema.safeParse(i).success,
    v3DMC: (i: unknown): i is V3MetadataBody<"dmc"> =>
      typeof i === "object" &&
      i !== null &&
      niconicoV3DMCSchema.safeParse(i).success,
    v3DMS: (i: unknown): i is V3MetadataBody<"dms"> =>
      typeof i === "object" &&
      i !== null &&
      niconicoV3DMSSchema.safeParse(i).success,
    v1AccessRightsHls: (i: unknown): i is V1AccessRightsHls =>
      typeof i === "object" &&
      i !== null &&
      niconicoV1AccessRightsHlsSchema.safeParse(i).success,
  },
  cookie: {
    parsedCookieKey: (i: unknown): i is keyof ParsedCookie =>
      typeof i === "string" && parsedCookieKeySchema.safeParse(i).success,
  },
};
export { typeGuard };
