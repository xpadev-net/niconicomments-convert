import type { FfmpegOptions } from "@/@types/ffmpeg";

const defaultOptions: FfmpegOptions = {
  sws_flags: "spline+accurate_rnd+full_chroma_int",
  "b:v": "0",
  crf: "30",
  filter_complex:
    "[0:v]fps=fps={FPS},pad=width=max(iw\\, ih*(16/9)):height=ow/(16/9):x=(ow-iw)/2:y=(oh-ih)/2,scale=w={width}:h={height}[video];[1:v]format=yuva444p,colorspace=bt709:iall=bt601-6-525:fast=1[baseImage];[1:v]format=rgba,alphaextract[alpha];[baseImage][alpha]alphamerge[image];[video][image]overlay[output]",
  color_range: "1",
  colorspace: "1",
  color_primaries: "1",
  color_trc: "1",
  "map:v": "[output]",
  "map:a": "0:a",
  r: "{FPS}",
};

export {defaultOptions}