import NiconiComments from "@xpadev-net/niconicomments";
import { sleep } from "./util/sleep";
import { typeGuard } from "./typeGuard";

const init = () => {
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
  const message = document.getElementById("msg");
  if (!message) return;
  let inProgress = false;
  let convertedFrames = 0;

  const sendBuffer = (buffer: string[]) => {
    window.api.request({ type: "buffer", host: "renderer", data: buffer });
  };
  const updateProgress = (generatedFrames: number) => {
    window.api.request({
      type: "progress",
      host: "renderer",
      data: { generated: generatedFrames },
    });
  };

  window.api.onResponse((_, data) => {
    if (data.target !== "renderer") return;
    if (typeGuard.renderer.start(data)) {
      inProgress = true;
      message.innerText = "コメントを処理しています...";
      if (data.format === "niconicome") {
        const parser = new DOMParser();
        data.data = parser.parseFromString(
          data.data as string,
          "application/xml"
        );
      }
      const canvas = document.getElementById("canvas") as HTMLCanvasElement;
      const nico = new NiconiComments(canvas, data.data, {
        format: data.format,
        ...data.options,
      });
      const emptyBuffer = canvas.toDataURL("image/png");
      message.innerText = "";
      let generatedFrames = 0,
        offset = Math.ceil(data.offset * 100);
      const totalFrames = data.frames;
      const process = async () => {
        for (let i = 0; i < data.fps; i++) {
          const vpos = Math.ceil(i * (100 / data.fps)) + offset;
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
            window.api.request({ type: "end", host: "renderer" });
            inProgress = false;
            message.innerText = "変換の終了を待っています...";
            return;
          }
        }
        offset += 100;
        while (generatedFrames - convertedFrames > 200) {
          await sleep(100);
        }
        setTimeout(() => void process(), 0);
      };
      void process();
    } else if (typeGuard.renderer.progress(data)) {
      convertedFrames = data.progress.converted;
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
  window.api.request({ type: "load", host: "renderer" });
};
if (window.location.search === "?renderer") {
  init();
}
