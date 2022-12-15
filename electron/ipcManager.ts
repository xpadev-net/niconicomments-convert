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
  setGeneratedFrames,
  totalFrames,
  videoOption,
} from "./context";
import { sendMessageToRenderer } from "./rendererWindow";
import { selectComment, selectMovie } from "./dialog";

const registerListener = () => {
  ipcMain.handle("request", async (IpcMainEvent, args) => {
    const value = (args as { data: unknown[] }).data[0];
    if (typeGuard.renderer.buffer(value)) {
      void appendBuffers(value.data);
    } else if (typeGuard.renderer.end(value)) {
      markAsCompleted();
    } else if (typeGuard.controller.selectComment(value)) {
      return await selectComment();
    } else if (typeGuard.controller.selectMovie(value)) {
      return await selectMovie();
    } else if (typeGuard.controller.start(value)) {
      return await convertStart(value);
    } else if (typeGuard.renderer.progress(value)) {
      setGeneratedFrames(value.data.generated);
    } else if (typeGuard.renderer.load(value)) {
      sendMessageToRenderer({
        type: "start",
        data: commendData.data,
        format: commendData.type,
        duration:
          (Number(videoOption.to) || duration) - (Number(videoOption.ss) || 0),
        offset: Number(videoOption.ss) || 0,
        fps: Number(videoOption.fps),
        frames: totalFrames,
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
    progress: {
      converted: convertedFrames,
      generated: generatedFrames,
      total: totalFrames,
    },
  });
  sendMessageToRenderer({
    type: "progress",
    progress: {
      converted: convertedFrames,
      generated: generatedFrames,
      total: totalFrames,
    },
  });
};

export { registerListener, updateProgress };
