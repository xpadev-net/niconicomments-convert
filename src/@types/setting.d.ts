import type { BrowserProfile } from "@/@types/cookies.js";
import type { FfmpegOptions } from "@/@types/ffmpeg.js";

export type AppSettings = {
  auth: AuthType;
  ffmpegOptions: FfmpegOptions;
  showRendererWindow: boolean;
  commentFileExt: string;
  updateCheck: UpdateCheckSetting;
};

// "unset": the opt-in dialog has not been answered yet.
export type UpdateCheckSetting = "unset" | "enabled" | "disabled";

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
