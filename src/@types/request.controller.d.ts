type apiRequestFromMain = {
  host: "main";
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
type apiRequestsFromMain =
  | apiRequestStart
  | apiRequestSelectComment
  | apiRequestSelectMovie;
