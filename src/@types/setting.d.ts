import type { BrowserProfile } from "@/@types/cookies";
import type { FfmpegOptions } from "@/@types/ffmpeg";

export type AppSettings = {
  auth: AuthType;
  ffmpegOptions: FfmpegOptions;
  showRendererWindow: boolean;
  commentFileExt: string;
};

export type AuthType = AuthByBrowserCookie | AuthByCookieFile | NoAuth;

export type AuthByCookieFile = {
  type: "cookie";
  path: string;
};
export type AuthByBrowserCookie = {
  type: "browser";
  profile?: BrowserProfile;
};
export type NoAuth = {
  type: "NoAuth";
};
