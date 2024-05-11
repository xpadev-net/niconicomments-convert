import type * as Stream from "node:stream";

import type { FfmpegOptions } from "@/@types/ffmpeg";
import type { ConvertQueue } from "@/@types/queue";

import { defaultOptions } from "./const";
import { Converter } from "./ffmpeg-stream/stream";
import { store } from "./store";

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
  converter.output(queue.output.path, getFfmpegOptions(queue));
  await converter.run();
};

const interruptConverter = (): void => {
  converter?.stop();
};

const getFfmpegOptions = (queue: ConvertQueue): FfmpegOptions => {
  const options =
    (store.get("ffmpegOptions") as FfmpegOptions | undefined) ?? defaultOptions;
  const replace = {
    "{FPS}": queue.option.fps.toString(),
    "{width}": queue.option.width.toString(),
    "{height}": queue.option.height.toString(),
  };
  for (const key of Object.keys(options)) {
    let value = options[key];
    if (!value) continue;
    for (const [k, v] of Object.entries(replace)) {
      value = value.replace(k, v);
    }
    options[key] = value;
  }
  return options;
};

export { inputStream, interruptConverter, startConverter };
