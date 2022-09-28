import NiconiComments from "@xpadev-net/niconicomments";
import { sleep } from "./utils";
import { typeGuard } from "./typeGuard";

const init = () => {
  document.body.innerHTML = `<canvas width="1920" height="1080" id="canvas"></canvas><style>
  canvas{
    width: 100vw;
    height: 100vh;
    object-fit: contain;
  }
  *{
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }</style>`;
  let inProgress = false;
  let convertedFrames = 0;
  window.api.onResponse((data) => {
    console.log(data);
    if (data.target !== "render") return;
    if (typeGuard.render.start(data)) {
      inProgress = true;
      const canvas = document.getElementById("canvas") as HTMLCanvasElement;
      // @ts-ignore
      const nico = new NiconiComments(canvas, data.comment, {
        format: "v1",
        ...data.options,
      });
      let generatedFrames = 0,
        offset = 0;
      const totalFrames = Math.ceil(data.duration * data.fps);
      const process = async () => {
        let buffer: string[] = [];
        for (let i = 0; i < data.fps; i++) {
          nico.drawCanvas(Math.ceil(i * (100 / data.fps)) + offset);
          buffer.push(canvas.toDataURL("image/png"));
          generatedFrames++;
          if (generatedFrames >= totalFrames) {
            window.api.request({
              type: "progress",
              host: "render",
              data: { generated: generatedFrames },
            });
            window.api.request({
              type: "buffer",
              host: "render",
              data: buffer,
            });
            window.api.request({ type: "end", host: "render" });
            inProgress = false;
            return;
          }
        }
        window.api.request({ type: "buffer", host: "render", data: buffer });
        offset += 100;
        window.api.request({
          type: "progress",
          host: "render",
          data: { generated: generatedFrames },
        });
        while (generatedFrames - convertedFrames > 200) {
          await sleep(100);
        }
        setTimeout(process, 0);
      };
      process();
    } else if (typeGuard.render.progress(data)) {
      convertedFrames = data.converted;
    } else if (typeGuard.render.end(data)) {
      window.close();
    }
  });
  window.onbeforeunload = (e) => {
    if (inProgress) {
      e.preventDefault();
      e.returnValue = "";
    }
  };
  window.api.request({ type: "load", host: "render" });
};
if (window.location.search === "?render") {
  init();
}
