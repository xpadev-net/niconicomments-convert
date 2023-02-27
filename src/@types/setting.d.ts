export type authType = authByBrowserCookie | authByCookieFile | noAuth;

export type authByCookieFile = {
  type: "cookie";
  path: string;
};
export type authByBrowserCookie = {
  type: "browser";
  browser: "firefox" | "chrome";
  profile?: string;
};
export type noAuth = {
  type: "noAuth";
};
