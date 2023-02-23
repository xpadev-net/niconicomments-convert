import { ipcMain } from "electron";
import { typeGuard } from "./typeGuard";
import { sendMessageToController } from "./controllerWindow";
import { selectComment, selectFile, selectMovie, selectOutput } from "./dialog";
import {
  appendBuffers,
  appendQueue,
  markAsCompleted,
  processingQueue,
  updateProgress,
} from "./queue";
import { store } from "./store";
import { download, getFormats } from "./lib/ytdlp";

const registerListener = () => {
  ipcMain.handle("request", async (IpcMainEvent, args) => {
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
      return await selectOutput();
    } else if (typeGuard.controller.selectFile(value)) {
      return await selectFile(value.pattern);
    } else if (typeGuard.controller.appendQueue(value)) {
      return appendQueue(value.data);
    } else if (typeGuard.controller.getSetting(value)) {
      return store.get(value.key);
    } else if (typeGuard.controller.setSetting(value)) {
      return store.set(value.key, value.data);
    } else if (typeGuard.controller.getMovieFormat(value)) {
      return await getFormats(value.url);
    } else if (typeGuard.controller.downloadMovie(value)) {
      const updateProgress = (total: number, downloaded: number) =>
        sendMessageToController({
          type: "downloadMovieProgress",
          total,
          downloaded,
        });
      return await download(value.url, value.format, updateProgress);
    } else if (typeGuard.renderer.progress(value)) {
      updateProgress(value.data.generated);
    } else if (typeGuard.renderer.load(value)) {
      return processingQueue;
    } else {
      sendMessageToController({
        type: "message",
        message: `unknown IPC Message: ${JSON.stringify(value)}`,
      });
    }
  });
};

export { registerListener };
