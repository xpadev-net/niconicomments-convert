import { ipcMain } from "electron";
import { ValidationError } from "../src/domain/validation";

import { sendMessageToController } from "./controller-window";
import {
  handleDropFiles,
  selectComment,
  selectFile,
  selectMovie,
  selectOutput,
} from "./dialog";
import { getAvailableProfiles } from "./lib/cookie";
import { encodeError, encodeJson } from "./lib/json";
import { getLogger } from "./lib/log";
import { getMetadata } from "./lib/niconico";
import {
  appendFrame,
  appendQueue,
  failConversion,
  isRendererSender,
  markAsCompleted,
  processOnInterrupt,
  processOnLoad,
  sendProgress,
} from "./queue";
import { setSetting, store } from "./store";
import { typeGuard } from "./type-guard";

const logger = getLogger("[ipcManager]");

const registerListener = (): void => {
  ipcMain.handle("request", async (event, args) => {
    const value = (args as { data: unknown[] }).data[0];
    const fromRenderer = isRendererSender(event.sender);
    if (
      typeof value === "object" &&
      value !== null &&
      "host" in value &&
      value.host === "renderer" &&
      !fromRenderer
    )
      return;
    try {
      if (typeGuard.renderer.failure(value)) {
        failConversion(event.sender.id, new Error(value.message));
        return;
      }
      if (typeGuard.renderer.blob(value)) {
        appendFrame(
          event.sender.id,
          value.sessionId,
          value.frameId,
          value.data,
        );
        return;
      }
      logger.debug("ipc message received", "ipcMessage:", value);
      if (typeGuard.renderer.end(value)) {
        markAsCompleted(event.sender.id, value.sessionId, value.frameId);
      } else if (typeGuard.controller.selectComment(value)) {
        return await selectComment();
      } else if (typeGuard.controller.selectMovie(value)) {
        return await selectMovie();
      } else if (typeGuard.controller.selectOutput(value)) {
        return await selectOutput(value.options);
      } else if (typeGuard.controller.selectFile(value)) {
        return await selectFile(value.pattern);
      } else if (typeGuard.controller.dropFiles(value)) {
        return await handleDropFiles(value.paths);
      } else if (typeGuard.controller.appendQueue(value)) {
        appendQueue(value.data);
        return true;
      } else if (typeGuard.controller.interruptQueue(value)) {
        processOnInterrupt(value.queueId);
        return;
      } else if (typeGuard.controller.getSetting(value)) {
        return store.get(value.key);
      } else if (typeGuard.controller.setSetting(value)) {
        return setSetting(value.key, value.data);
      } else if (typeGuard.controller.getAvailableProfiles(value)) {
        return await getAvailableProfiles();
      } else if (typeGuard.controller.getNiconicoMovieMetadata(value)) {
        return await getMetadata(value.nicoId);
      } else if (typeGuard.controller.getQueue(value)) {
        sendProgress();
        return;
      } else if (typeGuard.renderer.load(value)) {
        return await processOnLoad(event.sender.id);
      } else if (typeGuard.renderer.message(value)) {
        sendMessageToController(value);
      } else {
        logger.error("unknown ipc message", "ipcMessage:", value);
        sendMessageToController({
          type: "message",
          title: "未知のエラーが発生しました",
          message: `未知のIPCメッセージを受信しました\n${encodeJson(
            value,
          )}\nipcManager / unknownIpcMessage`,
        });
      }
    } catch (e: unknown) {
      if (e instanceof ValidationError) {
        sendMessageToController({
          type: "message",
          title: "入力内容を確認してください",
          message: e.message,
        });
        return false;
      }
      // The request may have outlived the renderer that sent it.
      if (fromRenderer) {
        if (isRendererSender(event.sender)) failConversion(event.sender.id, e);
        throw e;
      }
      logger.error(
        "failed to process ipc message",
        "ipcMessage:",
        value,
        "error:",
        e,
      );
      sendMessageToController({
        type: "message",
        title: "予期しないエラーが発生しました",
        message: `IPCメッセージ:\n${encodeJson(
          args,
        )}\nエラー内容:\n${encodeError(e)}\nipcManager / catchError`,
      });
    }
  });
};

export { registerListener };
