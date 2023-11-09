export type ChromiumBrowser =
  | "brave"
  | "chrome"
  | "chromium"
  | "edge"
  | "opera"
  | "vivaldi";
export type Browser = ChromiumBrowser | "firefox" | "safari";
export type Platform = "win32" | "darwin";

export type FirefoxProfile = FirefoxBasicProfile | FirefoxContainer;

export type FirefoxBasicProfile = {
  type: "firefoxBasicProfile";
  browser: "firefox";
  name: string;
  path: string;
};

export type FirefoxContainer = {
  type: "firefoxContainer";
  browser: "firefox";
  name: string;
  path: string;
  profileName: string;
  containerName: string;
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

export type ParsedCookie = {
  key: string;
  value: string;
  expires?: string;
  "Max-Age"?: string;
  path?: string;
  domain?: string;
};

export type ChromiumProfilesJson = {
  profile: {
    info_cache: {
      [profile_name: string]: {
        active_time: number;
        avatar_icon: string;
        background_apps: boolean;
        force_signin_profile_locked: boolean;
        gaia_id: string;
        is_consented_primary_account: boolean;
        is_ephemeral: boolean;
        is_using_default_avatar: boolean;
        is_using_default_name: boolean;
        managed_user_id: string;
        metrics_bucket_index: number;
        name: string;
        "signin.with_credential_provider": boolean;
        user_name: string;
      };
    };
  };
};

export type ChromiumProfile = {
  type: "chromiumProfile";
  browser: ChromiumBrowser;
  profileName: string;
  name: string;
  path: string;
};

export type columnInfo = {
  cid: number;
  name: string;
  type: string;
  notnull: number;
  dflt_value: unknown;
  pk: number;
}[];

export type chromiumCookies = {
  host_key: string;
  name: string;
  value: string;
  encrypted_value: Buffer;
  path: string;
  expires_utc: number;
  is_secure: number;
};

export type chromiumLocalState = {
  os_crypt: {
    encrypted_key: string;
  };
};

export type BrowserProfile = FirefoxProfile | ChromiumProfile;
