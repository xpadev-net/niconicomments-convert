import { Converter } from "./ffmpeg-stream/stream";
import * as Stream from "stream";
import { videoOptions } from "@/@types/options";
import { Queue } from "@/@types/queue";

let converter, inputStream: Stream.Writable;
const startConverter = async (queue: Queue) => {
  converter = new Converter();
  converter.createInputFromFile(queue.movie.path, queue.movie.option);
  inputStream = converter.createInputStream({
    f: "image2pipe",
    r: queue.output.fps,
    filter_complex: `pad=width=max(iw\\,ih*(16/9)):height=ow/(16/9):x=(ow-iw)/2:y=(oh-ih)/2,scale=1920x1080,overlay=x=0:y=0`,
  });
  converter.output(queue.output.path, {
    vcodec: "libx264",
    "b:v": "0",
    crf: "30",
    r: queue.output.fps,
  });
  await converter.run();
};

export { startConverter, inputStream };
