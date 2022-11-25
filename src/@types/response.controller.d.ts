type apiResponseToController = {
  target: "controller";
};
type apiResponseSelectMovie = {
  type: "selectMovie";
  message: string;
  data: {
    path: Electron.OpenDialogReturnValue;
    width: number;
    height: number;
    duration: number;
  };
};
type apiResponseSelectComment = {
  type: "selectComment";
  data:
    | formattedLegacyComment[]
    | rawApiResponse[]
    | ownerComment[]
    | v1Thread[]
    | XMLDocument
    | string;
  format:
    | "formatted"
    | "niconicome"
    | "legacy"
    | "owner"
    | "legacyOwner"
    | "v1";
};
type apiResponseProgress = {
  type: "progress";
  generated: number;
  converted: number;
};
type apiResponseStartController = {
  type: "start";
};
type apiResponseEnd = {
  type: "end";
};
type apiResponseMessage = {
  type: "message";
  message: string;
};

type apiResponsesToController =
  | apiResponseSelectComment
  | apiResponseSelectMovie
  | apiResponseProgress
  | apiResponseStartController
  | apiResponseEnd
  | apiResponseMessage;
