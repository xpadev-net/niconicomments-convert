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

export type apiRequestMessage = {
  type: "message";
  title?: string;
  message: string;
};
export type apiRequestsFromRenderer =
  | apiRequestProgress
  | apiRequestBuffer
  | apiRequestEnd
  | apiRequestLoad
  | apiRequestMessage;
