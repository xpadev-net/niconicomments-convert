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
