import { ipcMain } from "electron";
import { typeGuard } from "./typeGuard";
import { sendMessageToController } from "./controllerWindow";
import { selectComment, selectFile, selectMovie, selectOutput } from "./dialog";
import {
  appendBuffers,
  appendQueue,
  markAsCompleted,
  processingQueue,
  sendProgress,
  updateProgress,
} from "./queue";
import { store } from "./store";
import { getAvailableProfiles } from "./lib/cookie";
import { getMetadata } from "./lib/niconico";
import { encodeJson } from "./lib/json";

const registerListener = () => {
  ipcMain.handle("request", async (IpcMainEvent, args) => {
    try {
      const value = (args as { data: unknown[] }).data[0];
      if (typeGuard.renderer.buffer(value)) {
        appendBuffers(value.data);
      } else if (typeGuard.renderer.end(value)) {
        markAsCompleted();
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
        sendProgress();
        return;
      } else if (typeGuard.controller.getSetting(value)) {
        return store.get(value.key);
      } else if (typeGuard.controller.setSetting(value)) {
        return store.set(value.key, value.data);
      } else if (typeGuard.controller.getAvailableProfiles(value)) {
        return await getAvailableProfiles();
      } else if (typeGuard.controller.getNiconicoMovieMetadata(value)) {
        return await getMetadata(value.nicoId);
      } else if (typeGuard.renderer.progress(value)) {
        updateProgress(value.data.generated);
      } else if (typeGuard.renderer.load(value)) {
        return processingQueue;
      } else {
        sendMessageToController({
          type: "message",
          title: "未知のエラーが発生しました",
          message: `未知のIPCメッセージを受信しました\n${encodeJson(
            value
          )}\nipcManager / unknownIpcMessage`,
        });
      }
    } catch (e: unknown) {
      sendMessageToController({
        type: "message",
        title: "予期しないエラーが発生しました",
        message: `IPCメッセージ:\n${encodeJson(
          args
        )}\nエラー内容:\n${encodeJson(e)}\nipcManager / catchError`,
      });
    }
  });
};

export { registerListener };
