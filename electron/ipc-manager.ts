import type { IpcMainInvokeEvent } from "electron";
import { ipcMain } from "electron";

import type { RequestHandlers } from "@/@types/ipc.js";
import { ValidationError } from "../src/domain/validation.js";
import { baseUrl } from "./context.js";
import {
  isControllerSender,
  sendMessageToController,
} from "./controller-window.js";
import {
  handleDropFiles,
  selectComment,
  selectFile,
  selectMovie,
  selectOutput,
} from "./dialog.js";
import { isIpcRequest } from "./ipc-schema.js";
import { getAvailableProfiles } from "./lib/cookie.js";
import { encodeError } from "./lib/json.js";
import { getLogger } from "./lib/log.js";
import { getMetadata } from "./lib/niconico/index.js";
import {
  appendFrame,
  appendQueue,
  failConversion,
  isRendererSender,
  markAsCompleted,
  processOnInterrupt,
  processOnLoad,
  sendProgress,
} from "./queue.js";
import { store } from "./store.js";
import { onUpdateCheckSettingChanged } from "./updater.js";

const logger = getLogger("[ipcManager]");
const controllerHandlers: RequestHandlers["controller"] = {
  selectComment: () => selectComment(),
  selectMovie: () => selectMovie(),
  selectOutput: (request) => selectOutput(request.options),
  selectFile: (request) => selectFile(request.pattern),
  dropFiles: (request) => handleDropFiles(request.paths),
  appendQueue: (request) => {
    appendQueue(request.data);
    return true;
  },
  interruptQueue: (request) => {
    processOnInterrupt(request.queueId);
  },
  getSetting: (request) => store.get(request.key),
  setSetting: (request) => {
    store.set(request.key, request.data);
    if (request.key === "updateCheck") onUpdateCheckSettingChanged();
  },
  getAvailableProfiles: () => getAvailableProfiles(),
  getNiconicoMovieMetadata: (request) => getMetadata(request.nicoId),
  getQueue: () => {
    sendProgress();
  },
};

const isTrustedFrame = (
  event: IpcMainInvokeEvent,
  host: "controller" | "renderer",
): boolean => {
  const frame = event.senderFrame;
  if (!frame || event.sender.isDestroyed() || frame !== event.sender.mainFrame)
    return false;
  const expectedUrl = new URL(
    host === "renderer" ? `${baseUrl}?renderer` : baseUrl,
  ).href;
  return frame.url === expectedUrl;
};

const registerListener = (): void => {
  ipcMain.handle("request", async (event, value: unknown) => {
    // Authenticate the actual WebContents and frame before inspecting its payload.
    const host = isControllerSender(event.sender)
      ? "controller"
      : isRendererSender(event.sender)
        ? "renderer"
        : undefined;
    if (!host || !isTrustedFrame(event, host))
      throw new Error("Unauthorized IPC sender");
    try {
      if (!isIpcRequest(value) || value.host !== host)
        throw new Error("Invalid IPC request");
      if (value.host === "controller") {
        // The schema establishes the discriminant/payload correlation. The mapped
        // handler type checks every request's return type when handlers are defined.
        return await controllerHandlers[value.type](value as never);
      }
      switch (value.type) {
        case "failure":
          failConversion(event.sender.id, new Error(value.message));
          return;
        case "blob":
          appendFrame(
            event.sender.id,
            value.sessionId,
            value.frameId,
            value.data,
          );
          return;
        case "end":
          markAsCompleted(event.sender.id, value.sessionId, value.frameId);
          return;
        case "load":
          return await processOnLoad(event.sender.id);
        case "message":
          sendMessageToController(value);
          return;
      }
    } catch (error: unknown) {
      if (host === "renderer") {
        // A pending request may have outlived the session that sent it.
        if (isRendererSender(event.sender))
          failConversion(event.sender.id, error);
      } else {
        logger.error("failed to process ipc message", error);
        sendMessageToController({
          type: "message",
          title:
            error instanceof ValidationError
              ? "入力内容を確認してください"
              : "予期しないエラーが発生しました",
          message:
            error instanceof ValidationError
              ? error.message
              : `エラー内容:\n${encodeError(error)}\nipcManager / catchError`,
        });
      }
      throw error;
    }
  });
};

export { registerListener };
