import type { CommentFormat } from "@/@types/niconicomments";
import type { Queue } from "@/@types/queue";
import type { Movie } from "@/@types/types";

export type ApiResponseToController = {
  target: "controller";
};
export type ApiResponseSelectMovie = {
  type: "selectMovie";
  data: Movie;
};

export type ApiResponseSelectComment = {
  type: "selectComment";
  path: string;
  format: CommentFormat;
};
export type ApiResponseProgress = {
  type: "progress";
  data: Queue[];
};
export type ApiResponseStartController = {
  type: "start";
};
export type ApiResponseEnd = {
  type: "end";
};
export type ApiResponseMessage = {
  type: "message";
  title?: string;
  message: string;
};

export type ApiResponseDownloadMovie = {
  type: "downloadMovie";
  result: number;
};

export type ApiResponseDownloadMovieProgress = {
  type: "downloadMovieProgress";
  total: number;
  downloaded: number;
};

export type ApiResponsesToController =
  | ApiResponseSelectComment
  | ApiResponseSelectMovie
  | ApiResponseProgress
  | ApiResponseStartController
  | ApiResponseEnd
  | ApiResponseMessage
  | ApiResponseDownloadMovie
  | ApiResponseDownloadMovieProgress;

export {};
