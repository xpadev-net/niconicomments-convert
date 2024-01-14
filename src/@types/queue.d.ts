import type { Options } from "@xpadev-net/niconicomments";

import type { NicoId, UUID } from "@/@types/brand";
import type { TCommentOption, V3MetadataComment } from "@/@types/niconico";
import type { CommentFormat } from "@/@types/niconicomments";

export type Status =
  | "queued"
  | "processing"
  | "completed"
  | "fail"
  | "interrupted";

export type Queue = ConvertQueue | MovieQueue | CommentQueue;

type BaseQueue = {
  id: UUID;
  status: Status;
  message?: string;
  progress: number;
};

export type TCommentItem = TCommentItemLocal | TCommentItemRemote;

export type TCommentItemLocal = {
  type: "local";
  path: string;
  format: CommentFormat;
};

export type TCommentItemRemote = {
  type: "remote";
  path: string;
  format: "xml2js";
  ref: CommentQueue;
};

export type TMovieItem = TMovieItemLocal | TMovieItemRemote;

export type TMovieItemLocal = {
  type: "local";
  path: string;
  duration: number;
};

export type TMovieItemRemote = {
  type: "remote";
  path: string;
  duration: number;
  ref: MovieQueue;
};

export type TRemoteServerType = "dmc" | "dms";
export type TRemoteMovieItemFormat = TDMCFormat | TDMSFormat;

export type TDMCFormat = {
  type: "dmc";
  format: {
    audio: string;
    video: string;
  };
};

export type TDMSFormat = {
  type: "dms";
  format: [string, string];
};

export type ConvertQueue = BaseQueue & {
  type: "convert";
  comment: TCommentItem;
  movie: TMovieItem;
  output: {
    path: string;
  };
  option: {
    ss: number | undefined;
    to: number | undefined;
    fps: number;
    width: number;
    height: number;
    format: CommentFormat;
    options: Options;
  };
  wait?: UUID[];
};

export type MovieQueue = BaseQueue & {
  type: "movie";
  url: NicoId;
  format: TRemoteMovieItemFormat;
  path: string;
};

export type CommentQueue = BaseQueue & {
  type: "comment";
  url: NicoId;
  metadata: V3MetadataComment;
  option: TCommentOption;
  path: string;
};

export type QueueLists = {
  convert: ConvertQueue[];
  movie: MovieQueue[];
  comment: CommentQueue[];
};
