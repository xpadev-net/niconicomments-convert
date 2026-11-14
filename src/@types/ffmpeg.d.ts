export type FfprobeOutput = {
  streams: {
    width?: number;
    height?: number;
    duration?: string | number;
  }[];
};

export type FfmpegOptions = {
  [key: string]: string;
};
