import * as fs from "node:fs";
import { parseStringPromise } from "@xpadev-net/xml2js";

import type { UUID } from "@/@types/brand";
import type { ConvertQueue, Queue, QueueLists } from "@/@types/queue";
import type { ApiResponseLoad } from "@/@types/response.renderer";

import { sendMessageToController } from "./controller-window";
import { startConverter } from "./converter";
import { encodeError } from "./lib/json";
import { getLogger } from "./lib/log";
import {
  download,
  downloadComment,
  interruptCommentDownload,
} from "./lib/niconico";
import { interruptDMC } from "./lib/niconico/dmc";
import { interruptDMS } from "./lib/niconico/dms";
import {
  closeRendererWindow,
  createRendererWindow,
  sendMessageToRenderer,
} from "./renderer-window";

const logger = getLogger("[queue]");

const queueList: Queue[] = [];
const queueLists: QueueLists = {
  convert: [],
  movie: [],
  comment: [],
};
let processingQueue: ConvertQueue;
type ConversionSession = ReturnType<typeof startConverter> & {
  queue: ConvertQueue;
  lastFrame: number;
  endFrame: number;
  inputEndScheduled: boolean;
  frames: Map<number, Uint8Array>;
  writes: Promise<void>;
};
let activeSession: ConversionSession | undefined;

const appendQueue = (queue: Queue): void => {
  queueList.push(queue);
  if (queue.type === "convert") {
    queueLists.convert.push(queue);
    if (queue.comment.type === "remote") {
      queueList.push(queue.comment.ref);
      queueLists.comment.push(queue.comment.ref);
      void startCommentDownload();
    }
    if (queue.movie.type === "remote") {
      queueList.push(queue.movie.ref);
      queueLists.movie.push(queue.movie.ref);
      void startMovieDownload();
    }
    void startConvert();
  } else if (queue.type === "movie") {
    queueLists.movie.push(queue);
    void startMovieDownload();
  } else if (queue.type === "comment") {
    queueLists.comment.push(queue);
    void startCommentDownload();
  }
};

const startMovieDownload = async (): Promise<void> => {
  const queued = queueLists.movie.filter((i) => i.status === "queued");
  const targetQueue = queued[0];
  if (
    queueLists.movie.filter((i) => i.status === "processing").length > 0 ||
    queued.length === 0 ||
    !targetQueue
  )
    return;

  targetQueue.status = "processing";
  targetQueue.progress.percent = 0;
  sendProgress();
  try {
    await download(
      targetQueue.url,
      targetQueue.format,
      targetQueue.path,
      (total, downloaded) => {
        targetQueue.progress.percent = downloaded / total;
        sendProgress();
      },
    );
    if (targetQueue.status === "processing") targetQueue.status = "completed";
  } catch (e) {
    logger.error("failed to download movie", e);
    if (targetQueue.status === "processing") {
      targetQueue.status = "fail";
      sendMessageToController({
        type: "message",
        title: "動画のダウンロード中にエラーが発生しました",
        message: `エラー内容:\n${encodeError(e)}`,
      });
    }
  }
  sendProgress();
  void startMovieDownload();
  void startConvert();
};

const startCommentDownload = async (): Promise<void> => {
  const queued = queueLists.comment.filter((i) => i.status === "queued");
  const targetQueue = queued[0];
  if (
    queueLists.comment.filter((i) => i.status === "processing").length > 0 ||
    queued.length === 0 ||
    !targetQueue
  )
    return;
  targetQueue.status = "processing";
  targetQueue.progress.percent = 0;
  sendProgress();
  try {
    await downloadComment(targetQueue, (total, downloaded, message) => {
      targetQueue.progress = {
        percent: downloaded / total,
        total,
        processed: downloaded,
        message,
      };
      sendProgress();
    });
    if (targetQueue.status === "processing") targetQueue.status = "completed";
  } catch (e) {
    logger.error("failed to download comment", e);
    if (targetQueue.status === "processing") {
      targetQueue.status = "fail";
      sendMessageToController({
        type: "message",
        title: "コメントのダウンロード中にエラーが発生しました",
        message: `エラー内容:\n${encodeError(e)}`,
      });
    }
  }
  sendProgress();
  void startCommentDownload();
  void startConvert();
};

const startConvert = async (): Promise<void> => {
  // Propagate terminal dependency states, including chains of waiting jobs.
  let changed: boolean;
  do {
    changed = false;
    for (const queue of queueLists.convert) {
      if (queue.status !== "queued") continue;
      const dependency = (queue.wait ?? [])
        .map((id) => queueList.find((item) => item.id === id))
        .find(
          (item) => item?.status === "fail" || item?.status === "interrupted",
        );
      if (!dependency) continue;
      queue.status = dependency.status === "fail" ? "fail" : "interrupted";
      changed = true;
    }
    if (changed) sendProgress();
  } while (changed);

  if (activeSession) return;
  const queue = queueLists.convert.find(
    (item) =>
      item.status === "queued" &&
      (item.wait ?? []).every(
        (id) =>
          queueList.find((dependency) => dependency.id === id)?.status ===
          "completed",
      ),
  );
  if (!queue) return;
  processingQueue = queue;
  queue.status = "processing";
  queue.progress = {
    percent: 0,
    processed: 0,
    total:
      (queue.option.fps || 30) *
      ((queue.option.to ?? queue.movie.duration) - (queue.option.ss ?? 0)),
  };
  try {
    const session: ConversionSession = {
      ...startConverter(queue),
      queue,
      lastFrame: 0,
      endFrame: -1,
      inputEndScheduled: false,
      frames: new Map(),
      writes: Promise.resolve(),
    };
    activeSession = session;
    session.inputStream.once("error", (error) =>
      failConversion(error, session),
    );
    // Observe FFmpeg immediately, including failures during window creation.
    const finished = session.promise.catch((error: unknown) =>
      failConversion(error, session),
    );
    try {
      createRendererWindow((error) => failConversion(error, session));
      sendProgress();
      await finished;
      if (queue.status === "processing") queue.status = "completed";
    } catch (error) {
      failConversion(error, session);
    } finally {
      session.stop();
      session.frames.clear();
      closeRendererWindow();
      // Wait for FFmpeg to exit before starting the next conversion.
      await finished;
    }
  } catch (e) {
    failConversion(e);
  } finally {
    activeSession = undefined;
  }
  sendProgress();
  void startConvert();
};

const failConversion = (error: unknown, session = activeSession): void => {
  if (session !== activeSession || processingQueue?.status !== "processing")
    return;
  logger.error("failed to convert", error);
  processingQueue.status = "fail";
  session?.frames.clear();
  session?.stop();
  closeRendererWindow();
  sendMessageToController({
    type: "message",
    title: "書き出し中にエラーが発生しました",
    message: `エラー内容:\n${encodeError(error instanceof Error ? error : new Error(String(error)))}`,
  });
  sendProgress();
};

const finishInput = (session: ConversionSession): void => {
  if (session.lastFrame !== session.endFrame || session.inputEndScheduled)
    return;
  session.inputEndScheduled = true;
  void session.writes
    .then(() => {
      if (session === activeSession && session.queue.status === "processing")
        session.inputStream.end();
    })
    .catch((error: unknown) => failConversion(error, session));
};

const appendFrame = (frameId: number, data: Uint8Array): void => {
  const session = activeSession;
  if (session?.queue.status !== "processing") return;
  session.frames.set(frameId, data);
  while (session.frames.has(session.lastFrame + 1)) {
    session.lastFrame++;
    const frame = session.frames.get(session.lastFrame);
    if (frame) processFrame(session, frame);
    session.frames.delete(session.lastFrame);
  }
  finishInput(session);
};

const processFrame = (session: ConversionSession, data: Uint8Array): void => {
  session.writes = session.writes
    .then(async () => {
      if (session !== activeSession || session.queue.status !== "processing")
        return;
      await new Promise<void>((resolve, reject) => {
        session.inputStream.write(data, (error) =>
          error ? reject(error) : resolve(),
        );
      });
      if (session !== activeSession || session.queue.status !== "processing")
        return;
      session.queue.progress.processed++;
      session.queue.progress.percent =
        session.queue.progress.processed / session.queue.progress.total;
      sendProgress();
    })
    .catch((error: unknown) => failConversion(error, session));
};

const markAsCompleted = (frameId: number): void => {
  const session = activeSession;
  if (session?.queue.status !== "processing") return;
  session.endFrame = frameId;
  finishInput(session);
};
const sendProgress = (): void => {
  sendMessageToController({
    type: "progress",
    data: queueList,
  });
  processingQueue?.type === "convert" &&
    processingQueue.status === "processing" &&
    sendMessageToRenderer({
      type: "reportProgress",
      progress: processingQueue.progress,
    });
};

const processOnLoad = async (): Promise<ApiResponseLoad> => {
  const queue = processingQueue;
  let commentData = fs.readFileSync(queue.comment.path, "utf-8");
  if (queue.comment.format === "xml2js") {
    commentData = JSON.stringify(
      await parseStringPromise(commentData, { includeWhiteChars: true }),
    );
  }
  return {
    type: "load",
    commentData,
    queue,
  };
};

const processOnInterrupt = (queueId: UUID): void => {
  const queue = queueList.filter((i) => i.id === queueId)[0];
  if (queue?.status !== "processing" && queue?.status !== "queued") return;
  const wasQueued = queue.status === "queued";
  queue.status = "interrupted";
  sendProgress();
  if (wasQueued) {
    void startConvert();
    return;
  }
  if (queue.type === "convert") {
    activeSession?.frames.clear();
    activeSession?.stop();
    closeRendererWindow();
  } else if (queue.type === "movie") {
    if (queue.format.type === "dmc") interruptDMC();
    if (queue.format.type === "dms") interruptDMS();
  } else if (queue.type === "comment") {
    interruptCommentDownload();
  }
  void startConvert();
};

export {
  appendFrame,
  appendQueue,
  failConversion,
  markAsCompleted,
  processingQueue,
  processOnInterrupt,
  processOnLoad,
  queueLists,
  sendProgress,
};
