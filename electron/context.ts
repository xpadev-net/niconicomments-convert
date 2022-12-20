import type { Options as StreamOptions } from "./ffmpeg-stream/stream";
import { app } from "electron";
import { inputFormat, inputFormatType } from "@xpadev-net/niconicomments";
import { niconicommentsOptions } from "@/@types/options";

const baseUrl = app.isPackaged
  ? `file://${__dirname}/html/index.html`
  : "http://localhost:5173";
export { baseUrl };
