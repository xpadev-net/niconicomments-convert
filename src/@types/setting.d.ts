import type { BrowserProfile } from "@/@types/cookies";
import type { FfmpegOptions } from "@/@types/ffmpeg";

export type AppSettings = {
  auth: AuthType;
  ffmpegOptions: FfmpegOptions;
  showRendererWindow: boolean;
  commentFileExt: string;
  autoUpdate: AutoUpdateSetting;
};

// "unset": the opt-in dialog has not been answered yet.
export type AutoUpdateSetting = "unset" | "enabled" | "disabled";

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
