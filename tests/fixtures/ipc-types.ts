import type { IpcRequest, RequestHandlers } from "../../src/@types/ipc";
import type { ApiResponseLoad } from "../../src/@types/response.renderer";
import type { AuthType } from "../../src/@types/setting";

declare const request: IpcRequest;
const output: Promise<string | undefined> = request({
  host: "controller",
  type: "selectOutput",
  options: {},
});
const auth: Promise<AuthType | undefined> = request({
  host: "controller",
  type: "getSetting",
  key: "auth",
});
const show: Promise<boolean | undefined> = request({
  host: "controller",
  type: "getSetting",
  key: "showRendererWindow",
});
const load: Promise<ApiResponseLoad | undefined> = request({
  host: "renderer",
  type: "load",
});
// @ts-expect-error Settings keys are allowlisted.
request({ host: "controller", type: "getSetting", key: "auth.path" });
request({
  host: "controller",
  type: "setSetting",
  key: "showRendererWindow",
  // @ts-expect-error Settings values must match the selected key.
  data: "true",
});
// @ts-expect-error Renderer cannot use controller operations.
request({ host: "renderer", type: "selectFile", pattern: [] });
// @ts-expect-error Required payload fields cannot be omitted.
request({ host: "renderer", type: "blob", sessionId: "s", frameId: 1 });
// @ts-expect-error Results must match the request.
const wrongResult: Promise<boolean> = request({
  host: "controller",
  type: "selectOutput",
  options: {},
});
// @ts-expect-error Main handlers must return the declared response.
const wrongHandler: RequestHandlers["controller"]["selectOutput"] = () => true;
void [output, auth, show, load, wrongResult, wrongHandler];
