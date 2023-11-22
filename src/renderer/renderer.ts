import NiconiComments from "@xpadev-net/niconicomments";

import type { ApiResponseLoad } from "@/@types/response.renderer";
import { transformComments } from "@/renderer/comment-utils";
import { typeGuard } from "@/typeGuard";
import { encodeJson } from "@/util/json";
import { sleep } from "@/util/sleep";

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

  const sendBlob = (frameId: number, blob: Blob): void => {
    void blob.arrayBuffer().then((buffer) => {
      void window.api.request({
        type: "blob",
        host: "renderer",
        frameId: frameId + 1,
        data: new Uint8Array(buffer),
      });
    });
  };

  const { commentData, queue } = (await window.api.request({
    type: "load",
    host: "renderer",
  })) as ApiResponseLoad;
  inProgress = true;
  message.innerText = "コメントを処理しています...";
  const { format, data } = transformComments(queue.comment.format, commentData);
  const canvas = document.getElementById("canvas") as HTMLCanvasElement;
  const nico = new NiconiComments(canvas, data, {
    ...queue.option.options,
    format,
  });
  const emptyBuffer: Blob | null = await new Promise((resolve) =>
    canvas.toBlob((blob) => resolve(blob)),
  );
  message.innerText = "";
  let generatedFrames = 0,
    offset = Math.ceil((queue.option.ss ?? 0) * 100);
  const targetFrameRate = queue.option.fps || 30;
  const totalFrames =
    Math.ceil(
      (queue.option.to ?? queue.movie.duration) - (queue.option.ss ?? 0),
    ) * targetFrameRate;
  const process = async (): Promise<void> => {
    for (let i = 0; i < targetFrameRate; i++) {
      const vpos = Math.ceil(i * (100 / targetFrameRate)) + offset;
      const frame = generatedFrames;
      // eslint-disable-next-line
      if ((nico["timeline"][vpos]?.length || 0) === 0 && emptyBuffer) {
        sendBlob(frame, emptyBuffer);
      } else {
        nico.drawCanvas(vpos);
        canvas.toBlob((blob) => {
          if (!blob) return;
          sendBlob(frame, blob);
        });
      }
      generatedFrames++;
      if (generatedFrames >= totalFrames) {
        await window.api.request({
          type: "end",
          host: "renderer",
          frameId: generatedFrames,
        });
        inProgress = false;
        message.innerText = "変換の終了を待っています...";
        return;
      }
      await sleep(0);
    }
    offset += 100;
    while (generatedFrames - convertedFrames > 200) {
      await sleep(100);
    }
    setTimeout(() => void process(), 0);
  };
  void process();

  window.api.onResponse((_, data) => {
    if (data.target !== "renderer") return;
    if (typeGuard.renderer.reportProgress(data)) {
      convertedFrames = data.converted;
    } else if (typeGuard.renderer.end(data)) {
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
