import { browserProfile } from "@/@types/cookies";

export type authType = authByBrowserCookie | authByCookieFile | noAuth;

export type authByCookieFile = {
  type: "cookie";
  path: string;
};
export type authByBrowserCookie = {
  type: "browser";
  profile?: browserProfile;
};
export type noAuth = {
  type: "noAuth";
};
