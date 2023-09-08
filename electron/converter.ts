import { ConvertQueue } from "@/@types/queue";
import * as Stream from "stream";
import { Converter } from "./ffmpeg-stream/stream";

let converter, inputStream: Stream.Writable;
const startConverter = async (queue: ConvertQueue) => {
  converter = new Converter();
  converter.createInputFromFile(queue.movie.path, {
    ...queue.movie.option,
  });
  inputStream = converter.createInputStream({
    f: "image2pipe",
    r: queue.output.fps,
  });
  converter.output(queue.output.path, {
    vcodec: "libx264",
    "b:v": "0",
    crf: "30",
    filter_complex: `[0:v]fps=fps=${queue.output.fps},pad=width=max(iw\\, ih*(16/9)):height=ow/(16/9):x=(ow-iw)/2:y=(oh-ih)/2,scale=w=1920:h=1080[3];[3][1:v]overlay[out_v]`,
    "map:v": "[out_v]",
    "map:a": "0:a",
    r: queue.output.fps,
  });
  await converter.run();
};

export { startConverter, inputStream };
