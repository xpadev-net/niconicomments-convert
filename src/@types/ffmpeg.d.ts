export type FfprobeOutput = {
  streams: {
    width?: number;
    height?: number;
    duration?: number;
  }[];
};

export type FfmpegOptions = {
  [key: string]: string;
};
