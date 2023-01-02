export type authType = authByBrowserCookie | authByCookieFile;

export type authByCookieFile = {
  type: "cookie";
  path: string;
};
export type authByBrowserCookie = {
  type: "browser";
  browser: "firefox" | "chrome";
  profile?: string;
};
