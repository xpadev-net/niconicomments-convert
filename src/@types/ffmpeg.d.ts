export type FfprobeOutput = {
  streams: {
    width?: number;
    height?: number;
    duration?: number | string;
  }[];
};

export type FfmpegOptions = {
  [key: string]: string;
};
