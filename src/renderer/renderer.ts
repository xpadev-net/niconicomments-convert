import NiconiComments from "@xpadev-net/niconicomments";

import type { ApiResponseLoad } from "@/@types/response.renderer";
import { transformComments } from "@/renderer/comment-utils";
import {
  applyPreferFixedLocAt,
  type PreferFixedLocLimit,
  type TimelineComment,
} from "@/renderer/prefer-fixed-loc";
import { typeGuard } from "@/type-guard";
import { encodeJson } from "@/util/json";
import { getLogger } from "@/util/log";
import { sleep } from "@/util/sleep";

const logger = getLogger("[renderer]");

const setupRenderer = async (): Promise<void> => {
  document.title = "renderer - niconicomments-convert";
  document.body.innerHTML = `<canvas width="1920" height="1080" id="canvas"></canvas><div id="msg">準備しています...</div><style>
  canvas{
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    width: 100%;
    height: 100%;
    object-fit: contain;
  }
  div {
    height: 100vh;
    width: 100vw;
    position: fixed;
    top: 0;
    left: 0;
    text-align: center;
    line-height: 100vh;
  }
  html,body{
    width: 100vw;
    height: 100vh;
  }
  *{
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }</style>`;
  try {
    await startRenderer();
  } catch (e) {
    logger.error(e);
    await window.api.request({
      type: "message",
      title: "未知のエラーが発生しました",
      message: `エラー内容：\n${encodeJson(e)}`,
      host: "renderer",
    });
  }
};

const startRenderer = async (): Promise<void> => {
  const message = document.getElementById("msg");
  if (!message) return;
  let inProgress = false;
  let convertedFrames = 0;

  const { commentData, queue } = (await window.api.request({
    type: "load",
    host: "renderer",
  })) as ApiResponseLoad;
  inProgress = true;
  message.innerText = "コメントを処理しています...";
  const { format, data } = transformComments(queue.comment.format, commentData);
  const canvas = document.getElementById("canvas") as HTMLCanvasElement;
  canvas.width = queue.option.width;
  canvas.height = queue.option.height;
  const nico = new NiconiComments(canvas, data, {
    ...queue.option.options,
    format,
    lazy: true,
  });
  const nicoTimeline = (
    nico as unknown as { timeline?: Record<number, TimelineComment[]> }
  ).timeline;
  if (queue.option.preferFixedLoc && nicoTimeline === undefined) {
    throw new Error(
      "preferFixedLoc requires niconicomments timeline, but it was not found",
    );
  }
  const preferFixedLocLimit: PreferFixedLocLimit = {
    commentLimit: queue.option.options.config?.commentLimit,
    hideCommentOrder: queue.option.options.config?.hideCommentOrder,
  };
  const drawCanvas = (vpos: number): void => {
    if (!queue.option.preferFixedLoc) {
      nico.drawCanvas(vpos);
      return;
    }
    const original = applyPreferFixedLocAt(
      nicoTimeline,
      vpos,
      preferFixedLocLimit,
    );
    try {
      nico.drawCanvas(vpos);
    } finally {
      if (original && nicoTimeline) {
        nicoTimeline[vpos] = original;
      }
    }
  };
  const emptyBuffer: Blob | null = await new Promise((resolve) =>
    canvas.toBlob((blob) => resolve(blob)),
  );
  if (!emptyBuffer) {
    throw new Error("Failed to initialize canvas: canvas.toBlob returned null");
  }

  const sendBlob = async (frameId: number, blob: Blob): Promise<void> => {
    const buffer = await blob.arrayBuffer();
    await window.api.request({
      type: "blob",
      host: "renderer",
      frameId: frameId + 1,
      data: new Uint8Array(buffer),
    });
  };

  let droppedFrames = 0;
  const pendingSends: Promise<void>[] = [];
  const pendingBlobs: Promise<void>[] = [];

  const toBlobAsync = (canvas: HTMLCanvasElement): Promise<Blob | null> =>
    new Promise((resolve) => canvas.toBlob(resolve));

  const sendFrame = (frameId: number, blob: Blob): Promise<void> => {
    const promise = sendBlob(frameId, blob).catch((e) => {
      logger.error(`sendBlob failed at frame ${frameId}`, e);
      if (blob !== emptyBuffer) {
        logger.warn(`falling back to emptyBuffer for frame ${frameId}`);
        return sendBlob(frameId, emptyBuffer).catch((e2) => {
          logger.error(
            `sendBlob emptyBuffer fallback also failed at frame ${frameId}`,
            e2,
          );
          droppedFrames++;
        });
      }
      logger.error(
        `sendBlob with emptyBuffer failed at frame ${frameId} — no further fallback available`,
        e,
      );
      droppedFrames++;
    });
    pendingSends.push(promise);
    return promise;
  };
  message.innerText = "";
  let generatedFrames = 0;
  let offset = Math.ceil((queue.option.ss ?? 0) * 100);
  const targetFrameRate = queue.option.fps || 30;
  const totalFrames =
    Math.ceil(
      (queue.option.to ?? queue.movie.duration) - (queue.option.ss ?? 0),
    ) * targetFrameRate;
  const process = async (): Promise<void> => {
    await Promise.allSettled(pendingBlobs);
    pendingBlobs.length = 0;
    await Promise.allSettled(pendingSends);
    pendingSends.length = 0;
    for (let i = 0; i < targetFrameRate; i++) {
      const frame = generatedFrames;
      try {
        const vpos = Math.ceil(i * (100 / targetFrameRate)) + offset;
        // @ts-expect-error
        if ((nico.timeline[vpos]?.length || 0) === 0) {
          sendFrame(frame, emptyBuffer);
        } else {
          drawCanvas(vpos);
          pendingBlobs.push(
            toBlobAsync(canvas).then((blob) => {
              if (blob) {
                void sendFrame(frame, blob);
              } else {
                logger.warn(
                  `canvas.toBlob returned null at frame ${frame}, using emptyBuffer`,
                );
                void sendFrame(frame, emptyBuffer);
              }
            }),
          );
        }
      } catch (e) {
        logger.error(`process loop error at frame ${frame}`, e);
        logger.warn(`falling back to emptyBuffer for frame ${frame}`);
        sendFrame(frame, emptyBuffer);
      }
      generatedFrames++;
      if (generatedFrames >= totalFrames) {
        await Promise.allSettled(pendingBlobs);
        await Promise.allSettled(pendingSends);
        pendingBlobs.length = 0;
        pendingSends.length = 0;
        await window.api.request({
          type: "end",
          host: "renderer",
          frameId: generatedFrames - droppedFrames,
        });
        message.innerText = "変換の終了を待っています...";
        return;
      }
      await sleep(0);
    }
    offset += 100;
    while (generatedFrames - convertedFrames > 200) {
      logger.debug(`waiting... ${generatedFrames - convertedFrames}`);
      await sleep(100);
    }
    setTimeout(() => void process(), 0);
  };
  void process();

  window.api.onResponse((_, data) => {
    if (data.target !== "renderer") return;
    if (typeGuard.renderer.reportProgress(data)) {
      logger.debug(`received progress: ${data.progress.processed}`);
      convertedFrames = data.progress.processed;
    } else if (typeGuard.renderer.end(data)) {
      inProgress = false;
      window.close();
    }
  });
  window.onbeforeunload = (e) => {
    if (inProgress) {
      e.preventDefault();
      e.returnValue = "";
    }
  };
};

export { setupRenderer };
