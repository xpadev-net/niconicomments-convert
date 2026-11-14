import type { V1Thread } from "@xpadev-net/niconicomments";

import type {
  ApiResponsesToBinaryDownloader,
  ApiResponseToBinaryDownloader,
} from "@/@types/response.binary-downloader";
import type {
  ApiResponsesToRenderer,
  ApiResponseToRenderer,
} from "@/@types/response.renderer";

import type {
  ApiResponsesToController,
  ApiResponseToController,
} from "./response.controller";

declare global {
  interface Window {
    api: {
      request: import("./ipc").IpcRequest;
      onResponse: (
        callback: (_: unknown, data: ApiResponseType) => void,
      ) => void;
      remove: (callback: (_: unknown, data: ApiResponseType) => void) => void;
      getPathForFile: (file: File) => string;
    };
  }
}

export type ApiRequestType = import("./ipc").Request;
type ApiResponseType =
  | (ApiResponsesToController & ApiResponseToController)
  | (ApiResponsesToRenderer & ApiResponseToRenderer)
  | (ApiResponsesToBinaryDownloader & ApiResponseToBinaryDownloader);

export type Movie = {
  path: Electron.OpenDialogReturnValue;
  width: number;
  height: number;
  duration: number;
};

export type Message = {
  title: string;
  content: string;
};

export type V1Raw = {
  meta: {
    status: 200;
  };
  data: {
    threads: V1Thread[];
  };
};
