export type TWatchV3Metadata<T extends "dmc" | "dms" | "" = ""> = {
  meta: {
    status: 200;
  };
  data: V3MetadataBody<T>;
};

export type WatchPageMetadata<_T extends "dmc" | "dms" | "" = ""> = {
  meta: {
    status: 200;
  };
  data: {
    response: V3MetadataBody;
  };
};

export type V3MetadataBody<T extends "dmc" | "dms" | "" = ""> = {
  comment: V3MetadataComment;
  media: {
    delivery: T extends "dmc" ? V3MetadataDMCMedia : V3MetadataDMCMedia | null;
    domand: T extends "dms" ? V3MetadataDMSMedia : V3MetadataDMSMedia | null;
  };
  video: {
    id: string;
    title: string;
    description: string;
    count: {
      view: number;
      comment: number;
      mylist: number;
      like: number;
    };
    duration: number;
    thumbnail: {
      url: string;
      middleUrl: string;
      largeUrl: string;
      player: string;
      ogp: string;
    };
    rating: {
      isAdult: boolean;
    };
    registeredAt: string;
    isPrivate: boolean;
    isDeleted: boolean;
    isNoBanner: boolean;
    isAuthenticationRequired: boolean;
    isEmbedPlayerAllowed: boolean;
    viewer: unknown;
    watchableUserTypeForPayment: string;
    commentableUserTypeForPayment: string;
    "9d091f87": boolean;
  };
  viewer: V3MetadataViewerItem | null;
};

export type V3MetadataViewerItem = {
  id: number;
  nickname: string;
  isPremium: boolean;
  allowSensitiveContents: boolean;
  existence: {
    age: number;
    prefecture: string;
    sex: string;
  };
};

export type V3MetadataAudioItem = {
  id: string;
  isAvailable: boolean;
  metadata: {
    bitrate: number;
    samplingRate: number;
    levelIndex: number;
  };
};
export type V3MetadataVideoItem = {
  id: string;
  isAvailable: boolean;
  metadata: {
    label: string;
    bitrate: number;
    resolution: {
      width: number;
      height: number;
    };
    levelIndex: number;
  };
};

export type V3MetadataDMCMedia = {
  recipeId: string;
  encryption: null | {
    encryptedKey: string;
    keyUri: string;
  };
  movie: {
    contentId: string;
    audios: V3MetadataAudioItem[];
    videos: V3MetadataVideoItem[];
    session: {
      recipeId: string;
      playerId: string;
      videos: string[];
      audios: string[];
      movies: [];
      protocols: ["http", "hls"] | ["hls"];
      AuthTypes: { [key in "http" | "hls"]: "ht2" };
      serviceUserId: string;
      token: string;
      signature: string;
      contentId: string;
      heartbeatLifetime: number;
      contentKeyTimeout: number;
      priority: number;
      transferPresets: [] | ["standard2"];
      urls: {
        url: string;
        isWellKnownPort: boolean;
        isSsl: boolean;
      }[];
    };
  };
  trackingId: string;
};

export type V3MetadataDMSMedia = {
  videos: V3MetadataDMSVideoItem[];
  audios: V3MetadataDMSAudioItem[];
  accessRightKey: string;
};

export type V3MetadataDMSVideoItem = {
  id: string;
  isAvailable: boolean;
  label: string;
  bitRate: number;
  width: number;
  height: number;
  qualityLevel: number;
  recommendedHighestAudioQualityLevel: number;
};

export type V3MetadataDMSAudioItem = {
  id: string;
  isAvailable: boolean;
  bitRate: number;
  samplingRate: number;
  integratedLoudness: number;
  truePeak: number;
  qualityLevel: number;
};

export type V3MetadataComment = {
  server: {
    url: string;
  };
  keys: {
    userKey: string;
  };
  threads: V3MetadataCommentThread[];
  nvComment: V3MetadataNvComment;
};

export type V3MetadataCommentThread = {
  id: number;
  fork: number;
  forkLabel: "owner" | "main" | "easy";
  videoId: string;
  isActive: boolean;
  isDefaultPostTarget: boolean;
  isEasyCommentPostTarget: boolean;
  isLeafRequired: boolean;
  isOwnerThread: boolean;
  isThreadkeyRequired: boolean;
  threadkey: null | string;
  is184Forces: boolean;
  hasNicoscript: boolean;
  label:
    | "owner"
    | "default"
    | "community"
    | "easy"
    | "extra-community"
    | "extra-easy";
  postkeyStatus: number;
  server: string;
};

export type V3MetadataNvComment = {
  threadKey: string;
  server: string;
  params: {
    targets: {
      id: string;
      fork: string;
    }[];
    language: string;
  };
};

export type ContentSrcId = {
  src_id_to_mux: {
    audio_src_ids: string[];
    video_src_ids: string[];
  };
};

export type CreateSessionRequest = {
  session: {
    client_info: {
      player_id: string;
    };
    content_auth: {
      auth_type: "ht2";
      content_key_timeout: 600000;
      service_id: "nicovideo";
      service_user_id: string;
    };
    content_id: string;
    content_src_id_sets: {
      content_src_ids: ContentSrcId[];
    }[];
    content_type: "movie";
    content_uri: string;
    keep_method: {
      heartbeat: {
        lifetime: number;
      };
    };
    priority: number;
    protocol: {
      name: "http";
      parameters: {
        http_parameters: {
          parameters: {
            hls_parameters: {
              encryption?: {
                hls_encryption_v1: { encrypted_key: string; key_uri: string };
              };
              segment_duration: 6000;
              transfer_preset: string;
              use_ssl: "yes";
              use_well_known_port: "yes";
            };
          };
        };
      };
    };
    recipe_id: string;
    session_operation_auth: {
      session_operation_auth_by_signature: {
        signature: string;
        token: string;
      };
    };
    timing_constraint: "unlimited";
  };
};

export type SessionBody = {
  id: string;
  recipe_id: string;
  content_id: string;
  content_src_id_sets: {
    content_src_ids: ContentSrcId[];
    allow_subset: "yes";
  }[];
  content_type: "movie";
  timing_constraint: "unlimited";
  keep_method: {
    heartbeat: {
      lifetime: number;
      ontime_token: string;
      deletion_timeout_on_no_stream: number;
    };
  };
  protocol: {
    name: "http";
    parameters: {
      http_parameters: {
        method: "GET";
        parameters: {
          hls_parameters: {
            segment_duration: number;
            total_duration: number;
            transfer_preset: string;
            use_ssl: "yes";
            use_well_known_port: "yes";
            media_segment_format: "mpeg2ts";
            encryption:
              | {
                  hls_encryption_v1: { encrypted_key: string; key_uri: string };
                }
              | Record<string, never>;
            separate_audio_stream: "yes" | "no";
          };
        };
      };
    };
  };
  play_seek_time: number;
  play_speed: number;
  play_control_range: {
    max_play_speed: number;
    min_play_speed: number;
  };
  content_uri: string;
  session_operation_auth: {
    session_operation_auth_by_signature: {
      created_time: number;
      expire_time: number;
      token: string;
      signature: string;
    };
  };
  content_auth: {
    auth_type: "ht2";
    max_content_count: number;
    content_key_timeout: number;
    service_id: "nicovideo";
    service_user_id: string;
    content_auth_info: {
      method: "query";
      name: "ht2_nicovideo";
      value: string;
    };
  };
  runtime_info: {
    node_id: string;
    execution_history: [];
    thumbnailer_state: [];
  };
  client_info: {
    player_id: string;
    remote_ip: string;
    tracking_info: string;
  };
  created_time: number;
  modified_time: number;
  priority: number;
  content_route: number;
  version: string;
  content_status: string;
};

export type CreateSessionResponse = {
  meta: {
    status: 201 | 200;
    message: "created" | "ok";
  };
  data: {
    session: SessionBody;
  };
};
export type UpdateSessionResponse = {
  meta: {
    status: 200;
    message: "ok";
  };
  data: {
    session: SessionBody;
  };
};
export type DeleteSessionResponse = {
  meta: {
    status: 200;
    message: "ok";
  };
};

export type V1AccessRightsHls = {
  meta: {
    status: 201;
  };
  data: {
    contentUrl: string;
    createTime: string;
    expireTime: string;
  };
};

export type UserData = {
  meta: {
    status: 200;
  };
  data: {
    userId: string;
    nickname: string;
    area: string;
    language: string;
    locale: string;
    timezone: string;
    isExplicitlyLoginable: boolean;
    description: string;
    hasPremiumOreStrongerRights: boolean;
    hasSuperPremiumOrStrongerRights: boolean;
    premium: {
      type: "regular" | "premium";
    };
    icons: {
      urls: {
        "150x150": string;
        "50x50": string;
      };
    };
    existence: {
      residence: {
        country: string;
        prefecture: string;
      };
      birthday: string;
      sex: string;
    };
    contacts: {
      emails: {
        address: string;
        is_feature_phone: boolean;
        is_confirmed: boolean;
      }[];
    };
  };
};

export type TCommentThread = {
  threadId: number;
  fork: number;
  enable: boolean;
  label: string;
  forkLabel: "owner" | "main" | "easy";
};

export type TCommentPickerMode = "simple" | "custom";

export type TCommentOption = TCommentOptionCustom | TCommentOptionSimple;

export type TCommentOptionCustom = {
  type: "custom";
  start: string;
  end: TCommentOptionEndPoint;
  threads: TCommentThread[];
};

export type TCommentOptionSimple = {
  type: "simple";
  threads: TCommentThread[];
};

export type TCommentOptionEndPoint =
  | {
      type: "count";
      count: number;
    }
  | {
      type: "date";
      date: string;
    };
