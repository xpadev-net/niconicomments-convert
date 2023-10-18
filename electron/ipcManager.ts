import { ipcMain } from "electron";

import { sendMessageToController } from "./controllerWindow";
import { selectComment, selectFile, selectMovie, selectOutput } from "./dialog";
import { getAvailableProfiles } from "./lib/cookie";
import { encodeJson } from "./lib/json";
import { getMetadata } from "./lib/niconico";
import {
  appendFrame,
  appendQueue,
  markAsCompleted,
  processOnLoad,
} from "./queue";
import { store } from "./store";
import { typeGuard } from "./typeGuard";

const registerListener = (): void => {
  ipcMain.handle("request", async (IpcMainEvent, args) => {
    try {
      const value = (args as { data: unknown[] }).data[0];
      if (typeGuard.renderer.blob(value)) {
        appendFrame(value.frameId, value.data);
      } else if (typeGuard.renderer.end(value)) {
        markAsCompleted(value.frameId);
      } else if (typeGuard.controller.selectComment(value)) {
        return await selectComment();
      } else if (typeGuard.controller.selectMovie(value)) {
        return await selectMovie();
      } else if (typeGuard.controller.selectOutput(value)) {
        return await selectOutput(value.options);
      } else if (typeGuard.controller.selectFile(value)) {
        return await selectFile(value.pattern);
      } else if (typeGuard.controller.appendQueue(value)) {
        appendQueue(value.data);
        return;
      } else if (typeGuard.controller.getSetting(value)) {
        return store.get(value.key);
      } else if (typeGuard.controller.setSetting(value)) {
        return store.set(value.key, value.data);
      } else if (typeGuard.controller.getAvailableProfiles(value)) {
        return await getAvailableProfiles();
      } else if (typeGuard.controller.getNiconicoMovieMetadata(value)) {
        return await getMetadata(value.nicoId);
      } else if (typeGuard.renderer.load(value)) {
        return processOnLoad();
      } else if (typeGuard.renderer.message(value)) {
        sendMessageToController(value);
      } else {
        sendMessageToController({
          type: "message",
          title: "未知のエラーが発生しました",
          message: `未知のIPCメッセージを受信しました\n${encodeJson(
            value,
          )}\nipcManager / unknownIpcMessage`,
        });
      }
    } catch (e: unknown) {
      sendMessageToController({
        type: "message",
        title: "予期しないエラーが発生しました",
        message: `IPCメッセージ:\n${encodeJson(
          args,
        )}\nエラー内容:\n${encodeJson(e)}\nipcManager / catchError`,
      });
    }
  });
};

export { registerListener };
