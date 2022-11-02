interface Window {
  api: {
    request: (data: apiRequestType) => void;
    onResponse: (callback: (data: apiResponseType) => void) => void;
  };
}

type apiRequestType =
  | apiRequestSelectMovie
  | apiRequestSelectComment
  | apiRequestStart
  | apiRequestProgress
  | apiRequestBuffer
  | apiRequestEnd
  | apiRequestLoad;
type apiRequestFromMain = {
  host: "main";
};
type apiRequestFromRender = {
  host: "render";
};
type apiRequestSelectMovie = {
  type: "selectMovie";
} & apiRequestFromMain;
type apiRequestSelectComment = {
  type: "selectComment";
} & apiRequestFromMain;
type apiRequestStart = {
  type: "start";
  data: options;
  fps: number;
} & apiRequestFromMain;
type apiRequestProgress = {
  type: "progress";
  data: { generated: number };
} & apiRequestFromRender;
type apiRequestBuffer = {
  type: "buffer";
  data: string[];
} & apiRequestFromRender;
type apiRequestEnd = {
  type: "end";
} & apiRequestFromRender;
type apiRequestLoad = {
  type: "load";
} & apiRequestFromRender;

type apiResponseType =
  | apiResponseSelectMovie
  | apiResponseSelectComment
  | apiResponseProgress
  | apiResponseProgressRender
  | apiResponseStartMain
  | apiResponseStartRender
  | apiResponseEndMain
  | apiResponseEndRender;
type apiResponseToMain = {
  target: "main";
};
type apiResponseToRender = {
  target: "render";
};
type apiResponseSelectMovie = {
  type: "selectMovie";
  message: string;
  data: {
    path: Electron.OpenDialogReturnValue,
    width: number;
    height:number;
    duration: number;
  };
} & apiResponseToMain;
type apiResponseSelectComment = {
  type: "selectComment";
  data:  formattedLegacyComment[] | rawApiResponse[] | ownerComment[] | v1Thread[]|XMLDocument|string;
  format:"formatted"|"niconicome"|"legacy"|"owner"|"legacyOwner"|"v1";
} & apiResponseToMain;
type apiResponseProgress = {
  type: "progress";
  generated: number;
  converted: number;
} & apiResponseToMain;
type apiResponseProgressRender = {
  type: "progress";
  generated: number;
  converted: number;
} & apiResponseToRender;
type apiResponseStartMain = {
  type: "start";
} & apiResponseToMain;
type apiResponseStartRender = {
  type: "start";
  data:  formattedLegacyComment[] | rawApiResponse[] | ownerComment[] | v1Thread[]|XMLDocument|string;
  format:"formatted"|"niconicome"|"legacy"|"owner"|"legacyOwner"|"v1";
  options: options;
  duration: number;
  fps: number;
} & apiResponseToRender;
type apiResponseEndMain = {
  type: "end";
} & apiResponseToMain;
type apiResponseEndRender = {
  type: "end";
} & apiResponseToRender;

type options = {
  useLegacy: boolean;
  showCollision: boolean;
  showCommentCount: boolean;
  keepCA: boolean;
  scale: number;
};
type formattedComment = {
  id: number;
  vpos: number;
  content: string;
  date: number;
  date_usec: number;
  owner: boolean;
  premium: boolean;
  mail: string[];
  user_id: number;
  layer: number;
};
type formattedLegacyComment = {
  id: number;
  vpos: number;
  content: string;
  date: number;
  date_usec: number;
  owner: boolean;
  premium: boolean;
  mail: string[];
};
type rawApiResponse = {
  [key: string]: apiPing | apiThread | apiLeaf | apiGlobalNumRes | apiChat;
};
type apiPing = {
  content: string;
};
type apiThread = {
  resultcode: number;
  thread: string;
  server_time: number;
  ticket: string;
  revision: number;
};
type apiLeaf = {
  thread: string;
  count: number;
};
type apiGlobalNumRes = {
  thread: string;
  num_res: number;
};
type apiChat = {
  thread: string;
  no: number;
  vpos: number;
  date: number;
  date_usec: number;
  nicoru: number;
  premium: number;
  anonymity: number;
  user_id: string;
  mail: string;
  content: string;
  deleted: number;
};
type ownerComment = {
  time: string;
  command: string;
  comment: string;
};
type v1Thread = {
  id: string;
  fork: string;
  commentCount: number;
  comments: { [key: string]: v1Comment };
};
type v1Comment = {
  id: string;
  no: number;
  vposMs: number;
  body: string;
  commands: string[];
  userId: string;
  isPremium: boolean;
  score: number;
  postedAt: string;
  nicoruCount: number;
  nicoruId: undefined;
  source: string;
  isMyPost: boolean;
};
