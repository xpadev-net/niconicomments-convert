import type { V1Thread } from "@xpadev-net/niconicomments";

import type {
  ApiRequestFromRenderer,
  ApiRequestsFromRenderer,
} from "@/@types/request.renderer";
import type {
  ApiResponsesToBinaryDownloader,
  ApiResponseToBinaryDownloader,
} from "@/@types/response.binaryDownloader";
import type {
  ApiResponsesToRenderer,
  ApiResponseToRenderer,
} from "@/@types/response.renderer";

import type {
  ApiRequestFromController,
  ApiRequestsFromController,
} from "./request.controller";
import type {
  ApiResponsesToController,
  ApiResponseToController,
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

type Movie = {
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

type Message = {
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
