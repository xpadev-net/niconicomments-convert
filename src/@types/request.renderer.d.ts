export type apiRequestFromRenderer = {
  host: "renderer";
};

export type apiRequestProgress = {
  type: "progress";
  data: { generated: number };
};
export type apiRequestBuffer = {
  type: "buffer";
  data: string[];
};
export type apiRequestEnd = {
  type: "end";
};
export type apiRequestLoad = {
  type: "load";
};
export type apiRequestsFromRenderer =
  | apiRequestProgress
  | apiRequestBuffer
  | apiRequestEnd
  | apiRequestLoad;

export {};
