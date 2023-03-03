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

export type chromiumProfilesJson = {
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

export type chromiumProfile = {
  type: "chromiumProfile";
  browser: chromiumBrowser;
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
