import * as fs from "node:fs";
import { parseStringPromise } from "@xpadev-net/xml2js";

import type { UUID } from "@/@types/brand";
import type { Queue, QueueLists } from "@/@types/queue";
import type { ApiResponseLoad } from "@/@types/response.renderer";

import { sendMessageToController } from "./controller-window";
import { ConversionSession } from "./conversion-session";
import { encodeError } from "./lib/json";
import { getLogger } from "./lib/log";
import {
  download,
  downloadComment,
  interruptCommentDownload,
} from "./lib/niconico";
import { interruptDMC } from "./lib/niconico/dmc";
import { interruptDMS } from "./lib/niconico/dms";
import { createRendererWindow, sendMessageToRenderer } from "./renderer-window";

const logger = getLogger("[queue]");

const queueList: Queue[] = [];
const queueLists: QueueLists = {
  convert: [],
  movie: [],
  comment: [],
};
type ActiveSession = {
  conversion: ConversionSession;
  renderer?: ReturnType<typeof createRendererWindow>;
};
let activeSession: ActiveSession | undefined;
const isConversionProcessing = (): boolean => activeSession !== undefined;
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
    targetQueue.status = "completed";
  } catch (e) {
    logger.error("failed to download movie", e);
    targetQueue.status = "fail";
    sendMessageToController({
      type: "message",
      title: "動画のダウンロード中にエラーが発生しました",
      message: `エラー内容:\n${encodeError(e)}`,
    });
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
    targetQueue.status = "completed";
  } catch (e) {
    logger.error("failed to download comment", e);
    targetQueue.status = "fail";
    sendMessageToController({
      type: "message",
      title: "コメントのダウンロード中にエラーが発生しました",
      message: `エラー内容:\n${encodeError(e)}`,
    });
  }
  sendProgress();
  void startCommentDownload();
  void startConvert();
};

const startConvert = async (): Promise<void> => {
  const queued = queueLists.convert.filter((i) => i.status === "queued");
  if (activeSession || queued.length === 0 || !queued[0]) return;
  for (const queueId of queued[0].wait ?? []) {
    const queue = queueList.filter((i) => i.id === queueId)[0];
    if (queue?.status !== "completed") return;
  }
  const queue = queued[0];
  queue.status = "processing";
  queue.progress = {
    percent: 0,
    processed: 0,
    total:
      (queue.option.fps || 30) *
      ((queue.option.to ?? queue.movie.duration) - (queue.option.ss ?? 0)),
  };
  let session: ActiveSession | undefined;
  let status: Queue["status"] = "completed";
  try {
    session = { conversion: new ConversionSession(queue, sendProgress) };
    activeSession = session;
    session.renderer = createRendererWindow();
    sendProgress();
    await session.conversion.run();
  } catch (e) {
    if (!session?.conversion.interrupted) {
      status = "fail";
      logger.error("failed to convert", e);
      sendMessageToController({
        type: "message",
        title: "書き出し中にエラーが発生しました",
        message: `エラー内容:\n${encodeError(e)}`,
      });
    }
  } finally {
    // Keep the session lock and processing status until all resources are gone.
    await session?.conversion.dispose();
    if (session?.renderer && !session.renderer.isDestroyed()) {
      session.renderer.destroy();
    }
    queue.status = session?.conversion.interrupted ? "interrupted" : status;
    activeSession = undefined;
    sendProgress();
    void startConvert();
  }
};

const getRendererSession = (rendererId: number, sessionId?: string) => {
  const session = activeSession;
  if (
    !session ||
    session.conversion.interrupted ||
    session.renderer?.webContents.id !== rendererId ||
    (sessionId !== undefined && session.conversion.id !== sessionId)
  )
    return;
  return session;
};

const appendFrame = (
  rendererId: number,
  sessionId: string,
  frameId: number,
  data: Uint8Array,
): void => {
  getRendererSession(rendererId, sessionId)?.conversion.appendFrame(
    frameId,
    data,
  );
};

const markAsCompleted = (
  rendererId: number,
  sessionId: string,
  frameId: number,
): void => {
  getRendererSession(rendererId, sessionId)?.conversion.markAsCompleted(
    frameId,
  );
};
const sendProgress = (): void => {
  sendMessageToController({
    type: "progress",
    data: queueList,
  });
  const session = activeSession;
  if (session?.renderer && !session.conversion.interrupted) {
    sendMessageToRenderer(session.renderer, {
      type: "reportProgress",
      progress: session.conversion.queue.progress,
    });
  }
};

const processOnLoad = async (
  rendererId: number,
): Promise<ApiResponseLoad | undefined> => {
  const session = getRendererSession(rendererId);
  if (!session) return;
  const queue = session.conversion.queue;
  let commentData = fs.readFileSync(queue.comment.path, "utf-8");
  if (queue.comment.format === "xml2js") {
    commentData = JSON.stringify(
      await parseStringPromise(commentData, { includeWhiteChars: true }),
    );
  }
  if (getRendererSession(rendererId) !== session) return;
  return {
    type: "load",
    sessionId: session.conversion.id,
    commentData,
    queue,
  };
};

const processOnInterrupt = (queueId: UUID): void => {
  const queue = queueList.filter((i) => i.id === queueId)[0];
  if (queue?.status !== "processing") return;
  if (queue.type === "convert") {
    const session = activeSession;
    if (session?.conversion.queue !== queue) return;
    session.conversion.interrupt();
    if (session.renderer) {
      sendMessageToRenderer(session.renderer, { type: "end" });
    }
  } else if (queue.type === "movie") {
    queue.status = "interrupted";
    if (queue.format.type === "dmc") interruptDMC();
    if (queue.format.type === "dms") interruptDMS();
  } else if (queue.type === "comment") {
    queue.status = "interrupted";
    interruptCommentDownload();
  }
};

export {
  appendFrame,
  appendQueue,
  isConversionProcessing,
  markAsCompleted,
  processOnInterrupt,
  processOnLoad,
  queueLists,
  sendProgress,
};
