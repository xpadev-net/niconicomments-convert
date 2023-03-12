import type { ConvertQueue } from "@/@types/queue";
import { typeGuard } from "@/typeGuard";
import { encodeJson } from "@/util/json";
import { sleep } from "@/util/sleep";
import NiconiComments from "@xpadev-net/niconicomments";

const setupRenderer = async () => {
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

const startRenderer = async () => {
  const message = document.getElementById("msg");
  if (!message) return;
  let inProgress = false;
  let convertedFrames = 0;

  const sendBuffer = (buffer: string[]) => {
    void window.api.request({ type: "buffer", host: "renderer", data: buffer });
  };
  const updateProgress = (generatedFrames: number) => {
    void window.api.request({
      type: "progress",
      host: "renderer",
      data: { generated: generatedFrames },
    });
  };

  const data = (await window.api.request({
    type: "load",
    host: "renderer",
  })) as ConvertQueue;
  inProgress = true;
  message.innerText = "コメントを処理しています...";
  if (data.comment.options.format === "XMLDocument") {
    const parser = new DOMParser();
    data.comment.data = parser.parseFromString(
      data.comment.data as string,
      "application/xml"
    );
  }
  const canvas = document.getElementById("canvas") as HTMLCanvasElement;
  const nico = new NiconiComments(
    canvas,
    data.comment.data,
    data.comment.options
  );
  const emptyBuffer = canvas.toDataURL("image/png");
  message.innerText = "";
  let generatedFrames = 0,
    offset = Math.ceil((data.movie.option.ss || 0) * 100);
  const totalFrames = data.progress.total;
  const process = async () => {
    for (let i = 0; i < data.output.fps; i++) {
      const vpos = Math.ceil(i * (100 / data.output.fps)) + offset;
      // eslint-disable-next-line
      if ((nico["timeline"][vpos]?.length || 0) === 0) {
        sendBuffer([emptyBuffer]);
      } else {
        nico.drawCanvas(vpos);
        sendBuffer([canvas.toDataURL("image/png")]);
      }
      generatedFrames++;
      updateProgress(generatedFrames);
      if (generatedFrames >= totalFrames) {
        await window.api.request({ type: "end", host: "renderer" });
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
    if (typeGuard.renderer.progress(data)) {
      convertedFrames =
        data.data.type === "convert" ? data.data.progress.converted : 0;
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
