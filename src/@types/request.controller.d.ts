import type { Options } from "./options";
import { apiRequestLoad } from "@/@types/request.renderer";

export type apiRequestFromController = {
  host: "controller";
};
export type apiRequestSelectMovie = {
  type: "selectMovie";
};
export type apiRequestSelectComment = {
  type: "selectComment";
};
export type apiRequestStart = {
  type: "start";
  data: Options;
};
export type apiRequestsFromController =
  | apiRequestStart
  | apiRequestSelectComment
  | apiRequestSelectMovie
  | apiRequestLoad;

export {};
