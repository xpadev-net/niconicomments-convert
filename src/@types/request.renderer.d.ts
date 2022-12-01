type apiRequestFromRenderer = {
  host: "renderer";
};

type apiRequestProgress = {
  type: "progress";
  data: { generated: number };
};
type apiRequestBuffer = {
  type: "buffer";
  data: string[];
};
type apiRequestEnd = {
  type: "end";
};
type apiRequestLoad = {
  type: "load";
};
type apiRequestsFromRenderer =
  | apiRequestProgress
  | apiRequestBuffer
  | apiRequestEnd
  | apiRequestLoad;
