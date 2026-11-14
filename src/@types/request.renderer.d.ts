export type ApiRequestFromRenderer = {
  host: "renderer";
};

export type ApiRequestBuffer = {
  type: "buffer";
  data: string[];
};
export type ApiRequestBlob = {
  type: "blob";
  sessionId: string;
  frameId: number;
  data: Uint8Array;
};
export type ApiRequestEnd = {
  type: "end";
  sessionId: string;
  frameId: number;
};
export type ApiRequestLoad = {
  type: "load";
};

export type ApiRequestMessage = {
  type: "message";
  title?: string;
  message: string;
};
export type ApiRequestsFromRenderer =
  | ApiRequestBuffer
  | ApiRequestEnd
  | ApiRequestLoad
  | ApiRequestMessage
  | ApiRequestBlob;
