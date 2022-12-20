import type { Options } from "@xpadev-net/niconicomments";

type status = "queued" | "processing" | "completed";

type Queue = {
  id: string; //uuid
  status: status;
  comment: {
    path: string;
    options: Options;
  };
  movie: {
    path: string;
    duration: number;
  };
  progress: {
    generated: number;
    converted: number;
  };
};
