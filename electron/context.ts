import type { Options } from "./ffmpeg-stream/stream";

let inputPath = "";
const setInputPath = (val: string) => (inputPath = val);
let generatedFrames = 0;
const setGeneratedFrames = (val: number) => (generatedFrames = val);
let commendData: { type: inputFormatTypes; data: inputFormats };
const setCommentData = (val: { type: inputFormatTypes; data: inputFormats }) =>
  (commendData = val);
let videoOption: Options;
const setVideoOptions = (val: Options) => (videoOption = val);
let duration: number;
const setDuration = (val: number) => (duration = val);
let niconicommentsOption: options;
const setNiconicommentsOption = (val: options) => (niconicommentsOption = val);
export {
  inputPath,
  setInputPath,
  generatedFrames,
  setGeneratedFrames,
  commendData,
  setCommentData,
  videoOption,
  setVideoOptions,
  duration,
  setDuration,
  niconicommentsOption,
  setNiconicommentsOption,
};
