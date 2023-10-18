import type { BrowserProfile } from "@/@types/cookies";

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
