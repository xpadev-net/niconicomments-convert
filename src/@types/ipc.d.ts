import type { OpenDialogReturnValue } from "electron";
import type { BrowserProfile } from "./cookies";
import type { UserData, V3MetadataBody } from "./niconico";
import type { ApiRequestsFromController } from "./request.controller";
import type { ApiRequestsFromRenderer } from "./request.renderer";
import type {
  ApiResponseDropFiles,
  ApiResponseMessage,
  ApiResponseSelectComment,
  ApiResponseSelectMovie,
} from "./response.controller";
import type { ApiResponseLoad } from "./response.renderer";
import type { AppSettings } from "./setting";

export type ControllerRequest = ApiRequestsFromController & {
  host: "controller";
};
export type RendererRequest = ApiRequestsFromRenderer & { host: "renderer" };
export type Request = ControllerRequest | RendererRequest;

type ControllerResults = {
  selectComment: ApiResponseSelectComment | undefined;
  selectMovie: ApiResponseSelectMovie | ApiResponseMessage | undefined;
  selectOutput: string | undefined;
  selectFile: OpenDialogReturnValue;
  dropFiles: ApiResponseDropFiles;
  appendQueue: true;
  interruptQueue: undefined;
  setSetting: undefined;
  getAvailableProfiles: { profile: BrowserProfile; user: UserData }[];
  getNiconicoMovieMetadata: V3MetadataBody | undefined;
  getQueue: undefined;
};
type RendererResults = {
  load: ApiResponseLoad | undefined;
  blob: undefined;
  end: undefined;
  failure: undefined;
  message: undefined;
};

export type Result<R extends Request> = R extends {
  host: "controller";
  type: "getSetting";
  key: infer K extends keyof AppSettings;
}
  ? AppSettings[K]
  : R extends {
        host: "controller";
        type: infer T extends keyof ControllerResults;
      }
    ? ControllerResults[T]
    : R extends {
          host: "renderer";
          type: infer T extends keyof RendererResults;
        }
      ? RendererResults[T]
      : never;

export type IpcRequest = <R extends Request>(request: R) => Promise<Result<R>>;
export type RequestHandlers = {
  [H in Request["host"]]: {
    [T in Extract<Request, { host: H }>["type"]]: (
      request: Extract<Request, { host: H; type: T }>,
    ) =>
      | Result<Extract<Request, { host: H; type: T }>>
      | Promise<Result<Extract<Request, { host: H; type: T }>>>;
  };
};
