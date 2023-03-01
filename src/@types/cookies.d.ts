export type chromiumBrowser =
  | "brave"
  | "chrome"
  | "chromium"
  | "edge"
  | "opera"
  | "vivaldi";
export type browser = chromiumBrowser | "firefox" | "safari";
export type platform = "win32" | "darwin";

export type firefoxProfiles = firefoxProfile | firefoxContainer;

export type firefoxProfile = {
  type: "firefoxProfile";
  name: string;
  path: string;
};

export type firefoxContainer = {
  type: "firefoxContainer";
  name: string;
  path: string;
  contextId: number;
};

export type firefoxContainersJson = {
  version: number;
  lastUserContextId: number;
  identities: (firefoxContainerDefault | firefoxContainerUser)[];
};

export type l10nID =
  | "userContextPersonal.label"
  | "userContextWork.label"
  | "userContextBanking.label"
  | "userContextShopping.label";

export type firefoxContainerDefault = {
  userContextId: number;
  public: boolean;
  icon: string;
  color: string;
  l10nID: l10nID;
  accessKey: string;
  telemetryId: number;
};

export type firefoxContainerUser = {
  userContextId: number;
  public: boolean;
  icon: string;
  color: string;
  name: string;
  accessKey: string;
  telemetryId: number;
};

export type moz_cookies = {
  host: string;
  name: string;
  value: string;
  path: string;
  expiry: number;
  isSecure: number;
}[];

export type Cookies = {
  [key: string]: string;
};
