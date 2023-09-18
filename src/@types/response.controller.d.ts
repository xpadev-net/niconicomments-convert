import { Movie } from "@/@types/types";
import { InputFormat, InputFormatType } from "@xpadev-net/niconicomments";
import { Queue } from "@/@types/queue";

export type apiResponseToController = {
  target: "controller";
};
export type apiResponseSelectMovie = {
  type: "selectMovie";
  data: Movie;
};

export type apiResponseSelectComment = {
  type: "selectComment";
  data: InputFormat;
  format: InputFormatType;
};
export type apiResponseProgress = {
  type: "progress";
  data: Queue[];
};
export type apiResponseStartController = {
  type: "start";
};
export type apiResponseEnd = {
  type: "end";
};
export type apiResponseMessage = {
  type: "message";
  title?: string;
  message: string;
};

export type apiResponseDownloadMovie = {
  type: "downloadMovie";
  result: number;
};

export type apiResponseDownloadMovieProgress = {
  type: "downloadMovieProgress";
  total: number;
  downloaded: number;
};

export type apiResponsesToController =
  | apiResponseSelectComment
  | apiResponseSelectMovie
  | apiResponseProgress
  | apiResponseStartController
  | apiResponseEnd
  | apiResponseMessage
  | apiResponseDownloadMovie
  | apiResponseDownloadMovieProgress;

export {};
