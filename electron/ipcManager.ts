import { ipcMain } from "electron";
import { typeGuard } from "./typeGuard";
import { sendMessageToController } from "./controllerWindow";
import {
  appendBuffers,
  convertStart,
  markAsCompleted,
} from "./converterManager";
import {
  commendData,
  duration,
  generatedFrames,
  niconicommentsOption,
  setGeneratedFrames,
  videoOption,
} from "./context";
import { sendMessageToRenderer } from "./rendererWindow";
import { selectComment, selectMovie } from "./dialog";

const registerListener = () => {
  ipcMain.on("request", (IpcMainEvent, args) => {
    const value = (args as { data: unknown[] }).data[0];
    if (typeGuard.renderer.buffer(value)) {
      void appendBuffers(value.data);
    } else if (typeGuard.renderer.end(value)) {
      markAsCompleted();
    } else if (typeGuard.controller.selectComment(value)) {
      void selectComment();
    } else if (typeGuard.controller.selectMovie(value)) {
      void selectMovie();
    } else if (typeGuard.controller.start(value)) {
      void convertStart(value);
    } else if (typeGuard.renderer.progress(value)) {
      setGeneratedFrames(value.data.generated);
    } else if (typeGuard.renderer.load(value)) {
      sendMessageToRenderer({
        type: "start",
        data: commendData.data,
        format: commendData.type,
        options: niconicommentsOption,
        duration:
          (Number(videoOption.to) || duration) - (Number(videoOption.ss) || 0),
        offset: videoOption.ss || 0,
        fps: videoOption.fps,
      });
    } else {
      sendMessageToController({
        type: "message",
        message: `unknown IPC Message: ${JSON.stringify(value)}`,
      });
    }
  });
};

const updateProgress = (convertedFrames: number) => {
  sendMessageToController({
    type: "progress",
    converted: convertedFrames,
    generated: generatedFrames,
  });
  sendMessageToRenderer({
    type: "progress",
    converted: convertedFrames,
    generated: generatedFrames,
  });
};

export { registerListener, updateProgress };