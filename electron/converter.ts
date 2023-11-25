import type * as Stream from "stream";

import type { ConvertQueue } from "@/@types/queue";

import { Converter } from "./ffmpeg-stream/stream";

let inputStream: Stream.Writable;
let converter: Converter;
const startConverter = async (queue: ConvertQueue): Promise<void> => {
  converter = new Converter();
  converter.createInputFromFile(queue.movie.path, {
    ss: queue.option.ss,
    to: queue.option.to,
  });
  inputStream = converter.createInputStream({
    f: "image2pipe",
    r: queue.option.fps,
  });
  converter.output(queue.output.path, {
    vcodec: "libx264",
    pix_fmt: "yuv420p",
    "b:v": "0",
    crf: "30",
    filter_complex: `[0:v]fps=fps=${queue.option.fps},pad=width=max(iw\\, ih*(16/9)):height=ow/(16/9):x=(ow-iw)/2:y=(oh-ih)/2,scale=w=1920:h=1080[3];[1:v]scale=out_color_matrix=bt709[4];[3][4]overlay=format=rgb[out_v]`,
    "map:v": "[out_v]",
    "map:a": "0:a",
    r: queue.option.fps,
  });
  await converter.run();
};

const interruptConverter = (): void => {
  converter?.stop();
};

export { inputStream, interruptConverter, startConverter };
