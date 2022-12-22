import type { inputFormat, Options } from "@xpadev-net/niconicomments";

type status = "queued" | "processing" | "completed";

export type Queue = ConvertQueue; // | MovieQueue | CommentQueue;

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
  target: string; //nicovideo url
  progress: number;
  path: string;
};

type CommentDate = {
  type: "date";
  time: number;
};

type CommentCount = {
  type: "count";
  count: number;
};

export type CommentQueue = BaseQueue & {
  type: "comment";
  target: string; //nicovideo url
  start?: CommentDate;
  limit?: CommentDate | CommentCount;
  progress: number;
  path: string;
};
