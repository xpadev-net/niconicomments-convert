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
    sws_flags: "spline+accurate_rnd+full_chroma_int",
    "b:v": "0",
    crf: "30",
    filter_complex: `[0:v]fps=fps=${queue.option.fps},pad=width=max(iw\\, ih*(16/9)):height=ow/(16/9):x=(ow-iw)/2:y=(oh-ih)/2,scale=w=1920:h=1080[3];[1:v]format=yuva444p,colorspace=bt709:iall=bt601-6-525:fast=1[4];[1:v]format=rgba,alphaextract[5];[4][5]alphamerge[6];[3][6]overlay[out_v]`,
    color_range: 1,
    colorspace: 1,
    color_primaries: 1,
    color_trc: 1,
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
