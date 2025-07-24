import type { V1Thread } from "@xpadev-net/niconicomments";

import type {
  ApiRequestFromRenderer,
  ApiRequestsFromRenderer,
} from "@/@types/request.renderer";
import type {
  ApiResponseToBinaryDownloader,
  ApiResponsesToBinaryDownloader,
} from "@/@types/response.binary-downloader";
import type {
  ApiResponseToRenderer,
  ApiResponsesToRenderer,
} from "@/@types/response.renderer";

import type {
  ApiRequestFromController,
  ApiRequestsFromController,
} from "./request.controller";
import type {
  ApiResponseToController,
  ApiResponsesToController,
} from "./response.controller";

declare global {
  interface Window {
    api: {
      request: (data: ApiRequestType) => Promise<unknown>;
      onResponse: (
        callback: (_: unknown, data: ApiResponseType) => void,
      ) => void;
      remove: (callback: (_: unknown, data: ApiResponseType) => void) => void;
    };
  }
}

type ApiRequestType =
  | (ApiRequestsFromController & ApiRequestFromController)
  | (ApiRequestsFromRenderer & ApiRequestFromRenderer);
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

type Progress = {
  generated: number;
  converted: number;
  total: number;
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
