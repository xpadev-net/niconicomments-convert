import * as fs from "node:fs";
import { parseStringPromise } from "@xpadev-net/xml2js";
import type { WebContents } from "electron";

import type { UUID } from "@/@types/brand";
import type { Queue, QueueLists } from "@/@types/queue";
import type { ApiResponseLoad } from "@/@types/response.renderer";

import { sendMessageToController } from "./controller-window";
import { ConversionSession } from "./conversion-session";
import { encodeError } from "./lib/json";
import { getLogger } from "./lib/log";
import { download, downloadComment } from "./lib/niconico";
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
type ActiveSession = {
  conversion: ConversionSession;
  renderer?: ReturnType<typeof createRendererWindow>;
};
let activeSession: ActiveSession | undefined;
const isConversionProcessing = (): boolean => activeSession !== undefined;
let movieDownloadController: AbortController | undefined;
let commentDownloadController: AbortController | undefined;
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
  if (movieDownloadController || queued.length === 0 || !targetQueue) return;

  const controller = new AbortController();
  movieDownloadController = controller;
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
      controller.signal,
    );
    if (targetQueue.status === "processing") targetQueue.status = "completed";
  } catch (e) {
    if (targetQueue.status === "processing") {
      logger.error("failed to download movie", e);
      targetQueue.status = "fail";
      sendMessageToController({
        type: "message",
        title: "動画のダウンロード中にエラーが発生しました",
        message: `エラー内容:\n${encodeError(e)}`,
      });
    }
  } finally {
    movieDownloadController = undefined;
  }
  sendProgress();
  void startMovieDownload();
  void startConvert();
};

const startCommentDownload = async (): Promise<void> => {
  const queued = queueLists.comment.filter((i) => i.status === "queued");
  const targetQueue = queued[0];
  if (commentDownloadController || queued.length === 0 || !targetQueue) return;
  const controller = new AbortController();
  commentDownloadController = controller;
  targetQueue.status = "processing";
  targetQueue.progress.percent = 0;
  sendProgress();
  try {
    await downloadComment(
      targetQueue,
      (total, downloaded, message) => {
        targetQueue.progress = {
          percent: downloaded / total,
          total,
          processed: downloaded,
          message,
        };
        sendProgress();
      },
      controller.signal,
    );
    if (targetQueue.status === "processing") targetQueue.status = "completed";
  } catch (e) {
    if (targetQueue.status === "processing") {
      logger.error("failed to download comment", e);
      targetQueue.status = "fail";
      sendMessageToController({
        type: "message",
        title: "コメントのダウンロード中にエラーが発生しました",
        message: `エラー内容:\n${encodeError(e)}`,
      });
    }
  } finally {
    commentDownloadController = undefined;
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
          (item) =>
            item?.status === "fail" ||
            item?.status === "interrupted" ||
            (item === activeSession?.conversion.queue &&
              activeSession?.conversion.interrupted),
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
    const owner = session;
    session.renderer = createRendererWindow((error) =>
      failSession(owner, error),
    );
    sendProgress();
    await session.conversion.run();
  } catch (e) {
    session?.conversion.fail(e);
    if (!session?.conversion.interrupted) {
      status = "fail";
      logger.error("failed to convert", e);
      sendMessageToController({
        type: "message",
        title: "書き出し中にエラーが発生しました",
        message: `エラー内容:\n${encodeError(e instanceof Error ? e : new Error(String(e)))}`,
      });
    }
  } finally {
    // Keep the session lock and processing status until all resources are gone.
    await session?.conversion.dispose();
    if (session?.renderer) closeRendererWindow(session.renderer);
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
    session.conversion.failed ||
    session.renderer?.webContents.id !== rendererId ||
    (sessionId !== undefined && session.conversion.id !== sessionId)
  )
    return;
  return session;
};

const isRendererSender = (sender: WebContents): boolean => {
  const session = getRendererSession(sender.id);
  return (
    !!session?.renderer &&
    !session.renderer.isDestroyed() &&
    session.renderer.webContents === sender
  );
};

const failSession = (session: ActiveSession, error: unknown): void => {
  if (session !== activeSession) return;
  session.conversion.fail(error);
  if (session.renderer) closeRendererWindow(session.renderer);
};

const failConversion = (rendererId: number, error: unknown): void => {
  const session = getRendererSession(rendererId);
  if (session) failSession(session, error);
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
  if (
    session?.renderer &&
    !session.conversion.interrupted &&
    !session.conversion.failed
  ) {
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
  if (queue?.status !== "processing" && queue?.status !== "queued") return;
  if (queue.status === "queued") {
    queue.status = "interrupted";
    sendProgress();
    void startConvert();
    return;
  }
  if (queue.type === "convert") {
    const session = activeSession;
    if (session?.conversion.queue !== queue) return;
    session.conversion.interrupt();
    if (session.renderer) {
      sendMessageToRenderer(session.renderer, { type: "end" });
    }
  } else if (queue.type === "movie") {
    queue.status = "interrupted";
    movieDownloadController?.abort();
  } else if (queue.type === "comment") {
    queue.status = "interrupted";
    commentDownloadController?.abort();
  }
  sendProgress();
  void startConvert();
};

export {
  appendFrame,
  appendQueue,
  failConversion,
  isConversionProcessing,
  isRendererSender,
  markAsCompleted,
  processOnInterrupt,
  processOnLoad,
  queueLists,
  sendProgress,
};
