import type {
  apiRequestsFromController,
  apiRequestFromController,
} from "./request.controller";
import type {
  apiRequestsFromRenderer,
  apiRequestFromRenderer,
} from "./request.renderer";
import type {
  apiResponsesToController,
  apiResponseToController,
} from "./response.controller";
import type {
  apiResponsesToRenderer,
  apiResponseToRenderer,
} from "./response.renderer";
import type {
  apiResponsesToDownloader,
  apiResponseToDownloader,
} from "./response.downloader";
import type { v1Thread } from "@xpadev-net/niconicomments";

declare global {
  interface Window {
    api: {
      request: (data: apiRequestType) => Promise<unknown>;
      onResponse: (
        callback: (_: unknown, data: apiResponseType) => void
      ) => void;
      remove: (callback: (_: unknown, data: apiResponseType) => void) => void;
    };
  }
}

type apiRequestType =
  | (apiRequestsFromController & apiRequestFromController)
  | (apiRequestsFromRenderer & apiRequestFromRenderer);
type apiResponseType =
  | (apiResponsesToController & apiResponseToController)
  | (apiResponsesToRenderer & apiResponseToRenderer)
  | (apiResponsesToDownloader & apiResponseToDownloader);

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

export type v1Raw = {
  meta: {
    status: 200;
  };
  data: {
    threads: v1Thread[];
  };
};
