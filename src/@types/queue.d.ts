import type { inputFormat, Options } from "@xpadev-net/niconicomments";
import {
  availableNicovideoApi,
  commentOption,
  v3MetadataComment,
} from "@/@types/niconico";

type status = "queued" | "processing" | "completed";

export type Queue = ConvertQueue | MovieQueue | CommentQueue;

type BaseQueue = {
  id: string;
  status: status;
  message?: string;
};

export type ConvertQueue = BaseQueue & {
  type: "convert";
  comment: {
    data: inputFormat;
    options: Options;
  };
  movie: {
    path: string;
    duration: number;
    option: {
      ss: number | undefined;
      to: number | undefined;
    };
  };
  output: {
    path: string;
    fps: number;
  };
  progress: {
    generated: number;
    converted: number;
    total: number;
  };
};

export type MovieQueue = BaseQueue & {
  type: "movie";
  url: string; //nicoId
  format: NicovideoFormat;
  progress: number;
  path: string;
};

export type NicovideoFormat = {
  video: string;
  audio: string;
};

export type CommentQueue = BaseQueue & {
  type: "comment";
  target: string; //nicoId
  api: availableNicovideoApi;
  metadata: v3MetadataComment;
  option: commentOption;
  progress: number;
  path: string;
};

export type QueueLists = {
  convert: ConvertQueue[];
  movie: MovieQueue[];
  comment: CommentQueue[];
};
