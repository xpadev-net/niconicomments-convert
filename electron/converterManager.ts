import { dialog } from "electron";
import { sendMessageToController } from "./controllerWindow";
import { inputStream, startConverter } from "./converter";
import {
  duration,
  inputPath,
  setNiconicommentsOption,
  setTotalFrames,
  setVideoOptions,
} from "./context";
import { createRendererWindow, sendMessageToRenderer } from "./rendererWindow";
import * as Stream from "stream";
import { base64ToUint8Array } from "./utils";
import { updateProgress } from "./ipcManager";
import { apiRequestStart } from "@/@types/request.controller";

let convertedFrames = 0;
let convertQueue = Promise.resolve();

const convertStart = async (value: apiRequestStart) => {
  const outputPath = await dialog.showSaveDialog({
    filters: [{ name: "mp4", extensions: ["mp4"] }],
    properties: ["createDirectory"],
  });
  if (outputPath.canceled) return;
  setVideoOptions(value.data.video);
  setNiconicommentsOption(value.data.nico);

  sendMessageToController({
    type: "start",
  });
  setTotalFrames(
    Math.ceil(
      (value.data.video.end || duration) - (value.data.video.start || 0)
    ) * value.data.video.fps
  );
  convertedFrames = 0;
  createRendererWindow();
  try {
    await startConverter(inputPath, outputPath.filePath, value.data.video);
    sendMessageToRenderer({
      type: "end",
    });
    sendMessageToController({
      type: "end",
    });
  } catch (e) {
    sendMessageToController({
      type: "message",
      message: JSON.stringify(e),
    });
  }
};

const appendBuffers = (blobs: string[]) => {
  for (const key in blobs) {
    const item = blobs[key];
    const base64Image = item.split(";base64,").pop();

    convertQueue = convertQueue.then(() =>
      new Promise<void>((fulfill, reject) => {
        const myStream = new Stream.Readable();
        myStream._read = () => {
          const u8 = base64ToUint8Array(base64Image);
          myStream.push(u8);
          myStream.push(null);
        };
        convertedFrames++;
        updateProgress(convertedFrames);
        return myStream
          .on("end", () => fulfill())
          .on("error", () => reject())
          .pipe(inputStream, { end: false });
      }).catch((e) => {
        console.warn(e);
      })
    );
  }
};
const markAsCompleted = () => {
  void convertQueue.then(() => inputStream.end());
};

export { convertStart, appendBuffers, markAsCompleted };
