import NiconiComments from "@xpadev-net/niconicomments";
import { sleep } from "./utils";
import { typeGuard } from "./typeGuard";

const init = () => {
  document.body.innerHTML = `<canvas width="1920" height="1080" id="canvas"></canvas><style>
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
  html,body{
    width: 100vw;
    height: 100vh;
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
      if (data.format==="niconicome"){
        const parser = new DOMParser();
        data.data = parser.parseFromString(data.data as string, "application/xml");
      }
      const canvas = document.getElementById("canvas") as HTMLCanvasElement;
      // @ts-ignore
      const nico = new NiconiComments(canvas, data.data, {
        format: data.format,
        ...data.options,
      });
      let generatedFrames = 0,
        offset = Math.ceil(data.offset * 100);
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
