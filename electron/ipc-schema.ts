import type { NicoId, UUID } from "@/@types/brand";
import type { Request } from "@/@types/ipc";
import type {
  TCommentOption,
  TCommentThread,
  V3MetadataComment,
  V3MetadataCommentThread,
} from "@/@types/niconico";
import type { CommentFormat } from "@/@types/niconicomments";
import type {
  CommentQueue,
  ConvertQueue,
  MovieQueue,
  ProgressItem,
  Queue,
  TCommentItem,
  TMovieItem,
  TRemoteMovieItemFormat,
} from "@/@types/queue";
import type { AppSettings } from "@/@types/setting";

import { isSettingKey, parseSetting } from "../src/domain/settings";

// Each object schema must cover every declared field, including optional fields.
// IPC structured cloning removes accessors and custom prototypes before validation.
type Schema<T> = (value: unknown) => value is T;
type Shape<T> = { [K in keyof T]-?: Schema<T[K]> };
const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" &&
  value !== null &&
  (Object.getPrototypeOf(value) === Object.prototype ||
    Object.getPrototypeOf(value) === null);
const object =
  <T>(shape: Shape<T>, exact = false): Schema<T> =>
  (value: unknown): value is T =>
    record(value) &&
    Object.entries(shape).every(([key, check]) =>
      (check as Schema<unknown>)(value[key]),
    ) &&
    (!exact || Object.keys(value).every((key) => Object.hasOwn(shape, key)));
const string: Schema<string> = (value): value is string =>
  typeof value === "string";
const nonemptyString: Schema<string> = (value): value is string =>
  string(value) && value.trim().length > 0;
const boolean: Schema<boolean> = (value): value is boolean =>
  typeof value === "boolean";
const number: Schema<number> = (value): value is number =>
  typeof value === "number" && Number.isFinite(value);
const nonnegative: Schema<number> = (value): value is number =>
  number(value) && value >= 0;
const positive: Schema<number> = (value): value is number =>
  number(value) && value > 0;
const integer: Schema<number> = (value): value is number =>
  nonnegative(value) && Number.isSafeInteger(value);
const optional =
  <T>(schema: Schema<T>): Schema<T | undefined> =>
  (value): value is T | undefined =>
    value === undefined || schema(value);
const array =
  <T>(schema: Schema<T>): Schema<T[]> =>
  (value): value is T[] => {
    if (!Array.isArray(value)) return false;
    for (let index = 0; index < value.length; index++) {
      if (!Object.hasOwn(value, index) || !schema(value[index])) return false;
    }
    return true;
  };
const choices =
  <T extends string>(...values: T[]): Schema<T> =>
  (value): value is T =>
    string(value) && values.some((item) => item === value);
const uuid: Schema<UUID> = (value): value is UUID =>
  string(value) &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const nicoId: Schema<NicoId> = (value): value is NicoId =>
  string(value) && /^(?:sm|nm|so)?[1-9][0-9]*$/.test(value);
const date: Schema<string> = (value): value is string =>
  string(value) && Number.isFinite(Date.parse(value));
const format: Schema<CommentFormat> = choices(
  "XMLDocument",
  "niconicome",
  "xml2js",
  "formatted",
  "legacy",
  "legacyOwner",
  "owner",
  "v1",
  "empty",
  "default",
  "rawV1",
);
const filters = array(
  object<Electron.FileFilter>({ name: string, extensions: array(string) }),
);
const progress = object<ProgressItem>({
  percent: nonnegative,
  total: nonnegative,
  processed: nonnegative,
  message: optional(string),
});
const baseQueue = {
  id: uuid,
  status: choices("queued", "processing", "completed", "fail", "interrupted"),
  message: optional(string),
  progress,
};
const movieFormat: Schema<TRemoteMovieItemFormat> = (
  value,
): value is TRemoteMovieItemFormat =>
  object<Extract<TRemoteMovieItemFormat, { type: "dmc" }>>({
    type: choices("dmc"),
    format: object({ audio: string, video: string }),
  })(value) ||
  object<Extract<TRemoteMovieItemFormat, { type: "dms" }>>({
    type: choices("dms"),
    format: (v): v is [string, string] => array(string)(v) && v.length === 2,
  })(value);
const movieQueue = object<MovieQueue>({
  ...baseQueue,
  type: choices("movie"),
  url: nicoId,
  format: movieFormat,
  path: string,
});
const thread = object<TCommentThread>({
  threadId: integer,
  fork: integer,
  enable: boolean,
  label: string,
  forkLabel: choices("owner", "main", "easy"),
});
const commentOption: Schema<TCommentOption> = (
  value,
): value is TCommentOption =>
  object<Extract<TCommentOption, { type: "simple" }>>({
    type: choices("simple"),
    threads: array(thread),
  })(value) ||
  object<Extract<TCommentOption, { type: "custom" }>>({
    type: choices("custom"),
    start: date,
    threads: array(thread),
    end: (v): v is Extract<TCommentOption, { type: "custom" }>["end"] =>
      object({ type: choices("count"), count: positive })(v) ||
      object({ type: choices("date"), date })(v),
  })(value);
const metadataThread = object<V3MetadataCommentThread>({
  id: integer,
  fork: integer,
  forkLabel: choices("owner", "main", "easy"),
  videoId: string,
  isActive: boolean,
  isDefaultPostTarget: boolean,
  isEasyCommentPostTarget: boolean,
  isLeafRequired: boolean,
  isOwnerThread: boolean,
  isThreadkeyRequired: boolean,
  threadkey: (v): v is string | null => v === null || string(v),
  is184Forces: boolean,
  hasNicoscript: boolean,
  label: choices(
    "owner",
    "default",
    "community",
    "easy",
    "extra-community",
    "extra-easy",
  ),
  postkeyStatus: number,
  server: string,
});
const metadata = object<V3MetadataComment>({
  server: object({ url: string }),
  keys: object({ userKey: string }),
  threads: array(metadataThread),
  nvComment: object({
    threadKey: string,
    server: string,
    params: object({
      targets: array(object({ id: string, fork: string })),
      language: string,
    }),
  }),
});
const commentQueue = object<CommentQueue>({
  ...baseQueue,
  type: choices("comment"),
  url: nicoId,
  metadata,
  option: commentOption,
  path: string,
});
const comment: Schema<TCommentItem> = (value): value is TCommentItem =>
  object<Extract<TCommentItem, { type: "local" }>>({
    type: choices("local"),
    path: string,
    format,
  })(value) ||
  object<Extract<TCommentItem, { type: "remote" }>>({
    type: choices("remote"),
    path: string,
    format: choices("xml2js"),
    ref: commentQueue,
  })(value);
const movie: Schema<TMovieItem> = (value): value is TMovieItem =>
  object<Extract<TMovieItem, { type: "local" }>>({
    type: choices("local"),
    path: string,
    duration: positive,
  })(value) ||
  object<Extract<TMovieItem, { type: "remote" }>>({
    type: choices("remote"),
    path: string,
    duration: positive,
    ref: movieQueue,
  })(value);
const convertQueue = object<ConvertQueue>({
  ...baseQueue,
  type: choices("convert"),
  comment,
  movie,
  output: object({ path: string }),
  wait: optional(array(uuid)),
  option: object({
    ss: optional(nonnegative),
    to: optional(positive),
    fps: positive,
    width: positive,
    height: positive,
    format,
    options: object<ConvertQueue["option"]["options"]>(
      {
        showCollision: optional(boolean),
        showCommentCount: optional(boolean),
        keepCA: optional(boolean),
        scale: optional(positive),
        mode: optional(choices("default", "html5", "flash")),
      },
      true,
    ),
  }),
});
const queue: Schema<Queue> = (value): value is Queue =>
  convertQueue(value) || movieQueue(value) || commentQueue(value);
const settingKey = isSettingKey;
const validSetting = <K extends keyof AppSettings>(
  key: K,
  value: unknown,
): value is AppSettings[K] => {
  try {
    parseSetting(key, value);
    return true;
  } catch {
    return false;
  }
};

type RequestSchemas = {
  [H in Request["host"]]: {
    [T in Extract<Request, { host: H }>["type"]]: Schema<
      Extract<Request, { host: H; type: T }>
    >;
  };
};
const controller = { host: choices("controller") };
const renderer = { host: choices("renderer") };
const requestSchemas: RequestSchemas = {
  controller: {
    selectMovie: object({ ...controller, type: choices("selectMovie") }, true),
    selectComment: object(
      { ...controller, type: choices("selectComment") },
      true,
    ),
    selectOutput: object(
      {
        ...controller,
        type: choices("selectOutput"),
        options: object(
          {
            title: optional(string),
            defaultPath: optional(string),
            filters: optional(filters),
            properties: optional(
              array(
                choices(
                  "showHiddenFiles",
                  "createDirectory",
                  "treatPackageAsDirectory",
                  "showOverwriteConfirmation",
                  "dontAddToRecent",
                ),
              ),
            ),
          },
          true,
        ),
      },
      true,
    ),
    selectFile: object(
      { ...controller, type: choices("selectFile"), pattern: filters },
      true,
    ),
    dropFiles: object(
      { ...controller, type: choices("dropFiles"), paths: array(string) },
      true,
    ),
    appendQueue: object(
      { ...controller, type: choices("appendQueue"), data: queue },
      true,
    ),
    interruptQueue: object(
      { ...controller, type: choices("interruptQueue"), queueId: uuid },
      true,
    ),
    getSetting: object(
      { ...controller, type: choices("getSetting"), key: settingKey },
      true,
    ),
    setSetting: (value): value is Extract<Request, { type: "setSetting" }> =>
      object(
        {
          ...controller,
          type: choices("setSetting"),
          key: settingKey,
          data: (_): _ is unknown => true,
        },
        true,
      )(value) && validSetting(value.key, value.data),
    getAvailableProfiles: object(
      { ...controller, type: choices("getAvailableProfiles") },
      true,
    ),
    getNiconicoMovieMetadata: object(
      { ...controller, type: choices("getNiconicoMovieMetadata"), nicoId },
      true,
    ),
    getQueue: object({ ...controller, type: choices("getQueue") }, true),
  },
  renderer: {
    load: object({ ...renderer, type: choices("load") }, true),
    failure: object(
      { ...renderer, type: choices("failure"), message: string },
      true,
    ),
    message: object(
      {
        ...renderer,
        type: choices("message"),
        title: optional(string),
        message: string,
      },
      true,
    ),
    blob: object(
      {
        ...renderer,
        type: choices("blob"),
        sessionId: nonemptyString,
        // Frame IDs start at 1; zero is only valid as an empty end count.
        frameId: (value): value is number => integer(value) && value > 0,
        data: (value): value is Uint8Array =>
          value instanceof Uint8Array && value.byteLength > 0,
      },
      true,
    ),
    end: object(
      {
        ...renderer,
        type: choices("end"),
        sessionId: nonemptyString,
        frameId: integer,
      },
      true,
    ),
  },
};
const isIpcRequest = (value: unknown): value is Request => {
  if (!record(value) || !string(value.type)) return false;
  if (value.host !== "controller" && value.host !== "renderer") return false;
  const schemas = requestSchemas[value.host];
  return (
    Object.hasOwn(schemas, value.type) &&
    (schemas as Record<string, Schema<Request>>)[value.type](value)
  );
};

export { isIpcRequest, requestSchemas, settingKey, validSetting };
