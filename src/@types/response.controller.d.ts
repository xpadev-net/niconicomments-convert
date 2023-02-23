import { Movie } from "@/@types/types";
import { inputFormat, inputFormatType } from "@xpadev-net/niconicomments";
import { Queue } from "@/@types/queue";
import { ytdlpFormat } from "@/@types/ytdlp";

export type apiResponseToController = {
  target: "controller";
};
export type apiResponseSelectMovie = {
  type: "selectMovie";
  data: Movie;
};

export type apiResponseSelectComment = {
  type: "selectComment";
  data: inputFormat;
  format: inputFormatType;
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

export type apiResponseGetMovieFormat = {
  type: "getMovieFormat";
  formats: ytdlpFormat[];
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
  | apiResponseGetMovieFormat
  | apiResponseDownloadMovie
  | apiResponseDownloadMovieProgress;

export {};
