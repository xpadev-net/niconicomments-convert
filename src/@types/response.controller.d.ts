type apiResponseToController = {
  target: "controller";
};
type apiResponseSelectMovie = {
  type: "selectMovie";
  data: Movie;
};
type niconicommentsData =
  | formattedLegacyComment[]
  | rawApiResponse[]
  | ownerComment[]
  | v1Thread[]
  | XMLDocument
  | string;

type niconicommentsFormat =
  | "formatted"
  | "niconicome"
  | "legacy"
  | "owner"
  | "legacyOwner"
  | "v1";

type apiResponseSelectComment = {
  type: "selectComment";
  data: niconicommentsData;
  format: niconicommentsFormat;
};
type apiResponseProgress = {
  type: "progress";
  progress: Progress;
};
type apiResponseStartController = {
  type: "start";
};
type apiResponseEnd = {
  type: "end";
};
type apiResponseMessage = {
  type: "message";
  title?: string;
  message: string;
};

type apiResponsesToController =
  | apiResponseSelectComment
  | apiResponseSelectMovie
  | apiResponseProgress
  | apiResponseStartController
  | apiResponseEnd
  | apiResponseMessage;
