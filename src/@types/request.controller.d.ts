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
  data: Options;
};
type apiRequestsFromController =
  | apiRequestStart
  | apiRequestSelectComment
  | apiRequestSelectMovie
  | apiRequestLoad;
