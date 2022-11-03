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
  clipStart: number|undefined;
  clipEnd: number|undefined;
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
  offset:number;
} & apiResponseToRender;
type apiResponseEndMain = {
  type: "end";
} & apiResponseToMain;
type apiResponseEndRender = {
  type: "end";
} & apiResponseToRender;

type options = {
  showCollision: boolean;
  showCommentCount: boolean;
  keepCA: boolean;
  scale: number;
};