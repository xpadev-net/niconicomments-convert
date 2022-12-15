import type { Options as StreamOptions } from "./ffmpeg-stream/stream";
import { app } from "electron";
import { inputFormat, inputFormatType } from "@xpadev-net/niconicomments";
import { niconicommentsOptions } from "@/@types/options";

let inputPath = "";
const setInputPath = (val: string) => (inputPath = val);
let generatedFrames = 0;
const setGeneratedFrames = (val: number) => (generatedFrames = val);
let totalFrames = 0;
const setTotalFrames = (val: number) => (totalFrames = val);
let commendData: { type: inputFormatType; data: inputFormat };
const setCommentData = (val: { type: inputFormatType; data: inputFormat }) =>
  (commendData = val);
let videoOption: StreamOptions;
const setVideoOptions = (val: StreamOptions) => (videoOption = val);
let duration: number;
const setDuration = (val: number) => (duration = val);
let niconicommentsOption: niconicommentsOptions;
const setNiconicommentsOption = (val: niconicommentsOptions) =>
  (niconicommentsOption = val);
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
