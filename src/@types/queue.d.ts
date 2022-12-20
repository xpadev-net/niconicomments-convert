import type { inputFormat, Options } from "@xpadev-net/niconicomments";

type status = "queued" | "processing" | "completed";

type Queue = {
  id: string; //uuid
  status: status;
  comment: {
    data: inputFormat;
    options: Options;
  };
  movie: {
    path: string;
    duration: number;
    option: {
      start: number | undefined;
      end: number | undefined;
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
