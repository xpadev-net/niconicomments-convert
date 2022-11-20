import { dialog } from "electron";
import { sendMessageToController } from "./controllerWindow";
import type { Options } from "./ffmpeg-stream/stream";
import { inputStream, startConverter } from "./converter";
import { inputPath, setNiconicommentsOption, setVideoOptions } from "./context";
import { createRendererWindow, sendMessageToRenderer } from "./rendererWindow";
import * as Stream from "stream";
import { base64ToUint8Array } from "./utils";
import { updateProgress } from "./ipcManager";

let convertedFrames = 0;
let convertQueue = Promise.resolve() as Promise<void>;

const convertStart = async (IpcMainEvent, value) => {
  const outputPath = await dialog.showSaveDialog({
    filters: [{ name: "mp4", extensions: ["mp4"] }],
    properties: ["createDirectory"],
  });
  if (outputPath.canceled) return;
  const videoOption: Options = {},
    fps = value.fps;
  if (value.clipStart !== undefined) {
    videoOption.ss = value.clipStart;
  }

  if (value.clipEnd !== undefined) {
    videoOption.to = value.clipEnd;
  }
  const options = value.data;
  setVideoOptions({ ...videoOption, fps });
  setNiconicommentsOption(options);

  sendMessageToController({
    type: "start",
    message: `path:${outputPath.filePath}`,
  });
  convertedFrames = 0;
  createRendererWindow();
  try {
    await startConverter(inputPath, outputPath.filePath, options, fps);
    sendMessageToRenderer({
      type: "end",
    });
    sendMessageToController({
      type: "end",
    });
  } catch (e) {
    sendMessageToController({
      type: "message",
      message: `unknown error: ${JSON.stringify(e)}`,
    });
  }
};

const appendBuffers = async (blobs: string[]) => {
  for (const key in blobs) {
    const item = blobs[key];
    let base64Image = item.split(";base64,").pop();

    convertQueue = convertQueue.then(() =>
      new Promise<void>((fulfill, reject) => {
        const myStream = new Stream.Readable();
        myStream._read = function (size) {
          const u8 = base64ToUint8Array(base64Image);
          myStream.push(u8);
          myStream.push(null);
        };
        convertedFrames++;
        updateProgress(convertedFrames);
        return myStream
          .on("end", () => {
            fulfill();
          })
          .on("error", reject)
          .pipe(inputStream, { end: false });
      }).catch((e) => {
        console.warn(e);
      })
    );
  }
};
const markAsCompleted = () => {
  convertQueue.then(() => inputStream.end());
};

export { convertStart, appendBuffers, markAsCompleted };
