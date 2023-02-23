import { ConvertQueue, Queue } from "@/@types/queue";
import { inputStream, startConverter } from "./converter";
import { createRendererWindow, sendMessageToRenderer } from "./rendererWindow";
import { base64ToUint8Array } from "./utils";
import * as Stream from "stream";
import { sendMessageToController } from "./controllerWindow";

const convertQueueList: ConvertQueue[] = [];
let convertQueue = Promise.resolve();
let processingQueue: ConvertQueue;
const appendQueue = (queue: Queue) => {
  if (queue.type === "convert") {
    convertQueueList.push(queue);
    if (convertQueueList.filter((i) => i.status !== "completed").length === 1) {
      void startConvert();
    }
  }
};

const startConvert = async () => {
  const queued = convertQueueList.filter((i) => i.status === "queued");
  if (
    convertQueueList.filter((i) => i.status === "processing").length > 0 ||
    queued.length === 0 ||
    !queued[0]
  )
    return;
  if (queued[0].type == "convert") {
    processingQueue = queued[0];
    processingQueue.status = "processing";
    createRendererWindow();
    sendProgress();
    await startConverter(queued[0]);
    sendMessageToRenderer({
      type: "end",
    });
    processingQueue.status = "completed";
    sendProgress();
    void startConvert();
  }
};
const appendBuffers = (blobs: string[]) => {
  for (const key in blobs) {
    const item = blobs[key];
    const base64Image = item.split(";base64,").pop();
    if (!base64Image) continue;
    convertQueue = convertQueue.then(() =>
      new Promise<void>((fulfill, reject) => {
        const myStream = new Stream.Readable();
        myStream._read = () => {
          const u8 = base64ToUint8Array(base64Image);
          myStream.push(u8);
          myStream.push(null);
        };
        processingQueue.progress.converted++;
        sendProgress();
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
const updateProgress = (progress: number) => {
  processingQueue.progress.generated = progress;
  sendProgress();
};
const sendProgress = () => {
  sendMessageToController({
    type: "progress",
    data: convertQueueList,
  });
  sendMessageToRenderer({
    type: "progress",
    data: processingQueue,
  });
};

export {
  appendQueue,
  markAsCompleted,
  appendBuffers,
  updateProgress,
  processingQueue,
  convertQueueList,
};
