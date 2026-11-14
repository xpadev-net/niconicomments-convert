import NiconiComments from "@xpadev-net/niconicomments";

import type { ApiResponseLoad } from "@/@types/response.renderer";
import type { ApiResponseType } from "@/@types/types";
import { transformComments } from "@/renderer/comment-utils";
import { typeGuard } from "@/type-guard";
import { getLogger } from "@/util/log";
import { sleep } from "@/util/sleep";

const logger = getLogger("[renderer]");

const setupRenderer = async (): Promise<void> => {
  try {
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
    await startRenderer();
  } catch (e) {
    logger.error(e);
    try {
      await window.api.request({
        type: "failure",
        message: e instanceof Error ? (e.stack ?? e.message) : String(e),
        host: "renderer",
      });
    } catch (reportError) {
      logger.error("Failed to report renderer failure", reportError);
    }
  }
};

const startRenderer = async (): Promise<void> => {
  const message = document.getElementById("msg");
  if (!message) throw new Error("Renderer message element is missing");
  let inProgress = true;
  let convertedFrames = 0;
  let finish = (): void => {};
  const finished = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const onResponse = (_: unknown, data: ApiResponseType): void => {
    if (data.target !== "renderer") return;
    if (typeGuard.renderer.reportProgress(data)) {
      convertedFrames = data.progress.processed;
    } else if (typeGuard.renderer.end(data)) {
      inProgress = false;
      finish();
      window.close();
    }
  };
  window.api.onResponse(onResponse);
  window.onbeforeunload = (e) => {
    if (inProgress) {
      e.preventDefault();
      e.returnValue = "";
    }
  };

  try {
    const { commentData, queue } = (await window.api.request({
      type: "load",
      host: "renderer",
    })) as ApiResponseLoad;
    if (!inProgress) return;
    message.textContent = "コメントを処理しています...";
    const { format, data } = transformComments(
      queue.comment.format,
      commentData,
    );
    const canvas = document.getElementById("canvas") as HTMLCanvasElement;
    canvas.width = queue.option.width;
    canvas.height = queue.option.height;
    const nico = new NiconiComments(canvas, data, {
      ...queue.option.options,
      format,
      // Populate the timeline before using it to skip empty frames.
      lazy: false,
    });
    const toBlobAsync = (): Promise<Blob> =>
      new Promise((resolve, reject) => {
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error("canvas.toBlob returned null"));
        });
      });
    const emptyBuffer = await toBlobAsync();
    if (!inProgress) return;
    const sendBlob = async (frameId: number, blob: Blob): Promise<void> => {
      const buffer = await blob.arrayBuffer();
      if (!inProgress) return;
      await window.api.request({
        type: "blob",
        host: "renderer",
        frameId: frameId + 1,
        data: new Uint8Array(buffer),
      });
    };

    message.textContent = "";
    let generatedFrames = 0;
    let offset = Math.ceil((queue.option.ss ?? 0) * 100);
    const targetFrameRate = queue.option.fps || 30;
    const totalFrames =
      Math.ceil(
        (queue.option.to ?? queue.movie.duration) - (queue.option.ss ?? 0),
      ) * targetFrameRate;
    while (inProgress && generatedFrames < totalFrames) {
      const pendingFrames: Promise<void>[] = [];
      let frameFailed = false;
      for (
        let i = 0;
        inProgress &&
        !frameFailed &&
        i < targetFrameRate &&
        generatedFrames < totalFrames;
        i++
      ) {
        const frame = generatedFrames++;
        const vpos = Math.ceil(i * (100 / targetFrameRate)) + offset;
        const pendingFrame = (async () => {
          // @ts-expect-error
          if ((nico.timeline[vpos]?.length || 0) === 0) {
            await sendBlob(frame, emptyBuffer);
          } else {
            nico.drawCanvas(vpos);
            await sendBlob(frame, await toBlobAsync());
          }
        })();
        // Observe rejections before yielding; Promise.all propagates them below.
        void pendingFrame.catch(() => {
          frameFailed = true;
        });
        pendingFrames.push(pendingFrame);
        await sleep(0);
      }
      await Promise.all(pendingFrames);
      offset += 100;
      while (inProgress && generatedFrames - convertedFrames > 200) {
        await sleep(100);
      }
      await sleep(0);
    }
    if (!inProgress) return;
    await window.api.request({
      type: "end",
      host: "renderer",
      frameId: generatedFrames,
    });
    message.textContent = "変換の終了を待っています...";
    await finished;
  } finally {
    inProgress = false;
    window.api.remove(onResponse);
    window.onbeforeunload = null;
  }
};

export { setupRenderer };
