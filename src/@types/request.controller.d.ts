type apiRequestFromController = {
  host: "controller";
};
type apiRequestSelectMovie = {
  type: "selectMovie";
};
type apiRequestSelectComment = {
  type: "selectComment";
};
type apiRequestStart = {
  type: "start";
  data: options;
  fps: number;
  clipStart: number | undefined;
  clipEnd: number | undefined;
};
type apiRequestsFromController =
  | apiRequestStart
  | apiRequestSelectComment
  | apiRequestSelectMovie
  | apiRequestLoad;
