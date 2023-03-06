export type watchV3Metadata = {
  meta: {
    status: 200;
  };
  data: {
    media: {
      delivery: {
        recipeId: string;
        encryption: null | {
          encryptedKey: string;
          keyUri: string;
        };
        movie: {
          contentId: string;
          audios: {
            id: string;
            isAvailable: boolean;
            metadata: {
              bitrate: number;
              samplingRate: number;
              levelIndex: number;
            };
          }[];
          videos: {
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
          }[];
          session: {
            recipeId: string;
            playerId: string;
            videos: string[];
            audios: string[];
            movies: [];
            protocols: ["http", "hls"] | ["hls"];
            authTypes: { [key in "http" | "hls"]: "ht2" };
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
  };
};

export type content_src_id = {
  src_id_to_mux: {
    audio_src_ids: string[];
    video_src_ids: string[];
  };
};

export type createSessionRequest = {
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
      content_src_ids: content_src_id[];
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
    content_src_ids: content_src_id[];
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
            encryption: {};
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

export type createSessionResponse = {
  meta: {
    status: 201 | 200;
    message: "created" | "ok";
  };
  data: {
    session: SessionBody;
  };
};
export type updateSessionResponse = {
  meta: {
    status: 200;
    message: "ok";
  };
  data: {
    session: SessionBody;
  };
};
export type deleteSessionResponse = {
  meta: {
    status: 200;
    message: "ok";
  };
};
