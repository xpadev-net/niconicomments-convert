import type { Options } from "./ffmpeg-stream/stream";
import { app } from "electron";

let inputPath = "";
const setInputPath = (val: string) => (inputPath = val);
let generatedFrames = 0;
const setGeneratedFrames = (val: number) => (generatedFrames = val);
let totalFrames = 0;
const setTotalFrames = (val: number) => (totalFrames = val);
let commendData: { type: inputFormatTypes; data: inputFormats };
const setCommentData = (val: { type: inputFormatTypes; data: inputFormats }) =>
  (commendData = val);
let videoOption: Options;
const setVideoOptions = (val: Options) => (videoOption = val);
let duration: number;
const setDuration = (val: number) => (duration = val);
let niconicommentsOption: options;
const setNiconicommentsOption = (val: options) => (niconicommentsOption = val);
const baseUrl = app.isPackaged
  ? `file://${__dirname}/html/index.html`
  : "http://localhost:5173";
export {
  inputPath,
  setInputPath,
  generatedFrames,
  setGeneratedFrames,
  totalFrames,
  setTotalFrames,
  commendData,
  setCommentData,
  videoOption,
  setVideoOptions,
  duration,
  setDuration,
  niconicommentsOption,
  setNiconicommentsOption,
  baseUrl,
};
