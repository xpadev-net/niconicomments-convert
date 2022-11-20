import { Converter } from "./ffmpeg-stream/stream";
import type { Options } from "./ffmpeg-stream/stream";

let converter, inputStream;
const startConverter = async (
  inputPath: string,
  outputPath: string,
  option: Options,
  fps
) => {
  converter = new Converter();
  converter.createInputFromFile(inputPath, option);
  inputStream = converter.createInputStream({
    f: "image2pipe",
    r: fps,
    filter_complex: `pad=width=max(iw\\,ih*(16/9)):height=ow/(16/9):x=(ow-iw)/2:y=(oh-ih)/2,scale=1920x1080,overlay=x=0:y=0`,
  });
  converter.output(outputPath, { vcodec: "libx264", "b:v": "0", cq: "25" }); // output to file
  await converter.run();
};

export { startConverter, inputStream };
