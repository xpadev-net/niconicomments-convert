import type {
  ChromiumProfilesJson,
  firefoxContainerDefault,
  firefoxContainersJson,
  ParsedCookie,
} from "@/@types/cookies.js";
import type {
  CreateSessionResponse,
  TWatchV3Metadata,
  UserData,
  V1AccessRightsHls,
  V3MetadataBody,
  WatchPageMetadata,
} from "@/@types/niconico.js";

const typeGuard = {
  firefox: {
    containers: (i: unknown): i is firefoxContainersJson =>
      typeof i === "object" &&
      i !== null &&
      (i as firefoxContainersJson).version === 4 &&
      Array.isArray((i as firefoxContainersJson).identities),
    defaultContainer: (i: unknown): i is firefoxContainerDefault =>
      typeof i === "object" &&
      i !== null &&
      typeof (i as firefoxContainerDefault).l10nID === "string",
  },
  chromium: {
    profiles: (i: unknown): i is ChromiumProfilesJson =>
      typeof i === "object" &&
      i !== null &&
      typeof (i as ChromiumProfilesJson).profile === "object" &&
      typeof (i as ChromiumProfilesJson).profile?.info_cache === "object",
  },
  niconico: {
    userData: (i: unknown): i is UserData =>
      typeof i === "object" &&
      i !== null &&
      (i as UserData).meta?.status === 200 &&
      typeof (i as UserData).data?.userId === "string",
    TWatchV3Metadata: (i: unknown): i is TWatchV3Metadata =>
      typeof i === "object" &&
      i !== null &&
      (i as TWatchV3Metadata).meta?.status === 200 &&
      typeof (i as TWatchV3Metadata).data === "object",
    WatchPageJson: (i: unknown): i is WatchPageMetadata =>
      typeof i === "object" &&
      i !== null &&
      (i as WatchPageMetadata).meta?.status === 200 &&
      typeof (i as WatchPageMetadata).data === "object" &&
      typeof (i as WatchPageMetadata).data?.response === "object",
    CreateSessionResponse: (i: unknown): i is CreateSessionResponse =>
      typeof i === "object" &&
      i !== null &&
      ((i as CreateSessionResponse).meta?.status === 201 ||
        (i as CreateSessionResponse).meta?.status === 200) &&
      ((i as CreateSessionResponse).meta?.message === "created" ||
        (i as CreateSessionResponse).meta?.message === "ok") &&
      typeof (i as CreateSessionResponse).data === "object",
    v3DMC: (i: unknown): i is V3MetadataBody<"dmc"> =>
      typeof i === "object" &&
      i !== null &&
      !!(i as V3MetadataBody).media?.delivery,
    v3DMS: (i: unknown): i is V3MetadataBody<"dms"> =>
      typeof i === "object" &&
      i !== null &&
      !!(i as V3MetadataBody).media?.domand,
    v1AccessRightsHls: (i: unknown): i is V1AccessRightsHls =>
      typeof i === "object" &&
      i !== null &&
      (i as V1AccessRightsHls).meta?.status === 201 &&
      typeof (i as V1AccessRightsHls).data === "object",
  },
  cookie: {
    parsedCookieKey: (i: unknown): i is keyof ParsedCookie =>
      typeof i === "string" && !!i.match(/expires|Max-Age|path|domain/),
  },
};

export { typeGuard };
