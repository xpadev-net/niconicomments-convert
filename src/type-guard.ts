import { z } from "zod";

import type { V3MetadataBody } from "@/@types/niconico";
import type { ApiResponseDownloadProgress } from "@/@types/response.binary-downloader";
import type {
  ApiResponseDropFiles,
  ApiResponseEnd,
  ApiResponseMessage,
  ApiResponseProgress,
  ApiResponseSelectComment,
  ApiResponseSelectMovie,
  ApiResponseStartController,
} from "@/@types/response.controller";
import type { ApiResponseReportProgress } from "@/@types/response.renderer";

// Controller schemas
const selectMovieSchema = z.object({
  type: z.literal("selectMovie"),
  data: z.any(), // Movie型は複雑なため部分検証
});

const selectCommentSchema = z.object({
  type: z.literal("selectComment"),
  path: z.string(),
  format: z.any(), // CommentFormat型
});

const dropFilesSchema = z.object({
  type: z.literal("dropFiles"),
  movie: z.any().optional(), // Movie型
  comment: z
    .object({
      path: z.string(),
      format: z.any(),
    })
    .optional(),
});

const progressSchema = z.object({
  type: z.literal("progress"),
  data: z.any(), // Queue[]型は複雑なため部分検証
});

const startSchema = z.object({
  type: z.literal("start"),
});

const endSchema = z.object({
  type: z.literal("end"),
});

const messageSchema = z.object({
  type: z.literal("message"),
  title: z.string().optional(),
  message: z.string(),
});

const v3DMCSchema = z.object({
  media: z.object({
    delivery: z.any(),
  }),
});

const v3DMSSchema = z.object({
  media: z.object({
    domand: z.any(),
  }),
});

// Renderer schemas
const reportProgressSchema = z.object({
  type: z.literal("reportProgress"),
  progress: z.any(), // ProgressItem型
});

// BinaryDownloader schemas
const downloadProgressSchema = z.object({
  type: z.literal("downloadProgress"),
  name: z.string(),
  progress: z.number(),
});

const typeGuard = {
  controller: {
    selectMovie: (i: unknown): i is ApiResponseSelectMovie =>
      typeof i === "object" &&
      i !== null &&
      selectMovieSchema.safeParse(i).success,
    selectComment: (i: unknown): i is ApiResponseSelectComment =>
      typeof i === "object" &&
      i !== null &&
      selectCommentSchema.safeParse(i).success,
    dropFiles: (i: unknown): i is ApiResponseDropFiles =>
      typeof i === "object" &&
      i !== null &&
      dropFilesSchema.safeParse(i).success,
    progress: (i: unknown): i is ApiResponseProgress =>
      typeof i === "object" &&
      i !== null &&
      progressSchema.safeParse(i).success,
    start: (i: unknown): i is ApiResponseStartController =>
      typeof i === "object" && i !== null && startSchema.safeParse(i).success,
    end: (i: unknown): i is ApiResponseEnd =>
      typeof i === "object" && i !== null && endSchema.safeParse(i).success,
    message: (i: unknown): i is ApiResponseMessage =>
      typeof i === "object" && i !== null && messageSchema.safeParse(i).success,
    v3DMC: (i: unknown): i is V3MetadataBody<"dmc"> =>
      typeof i === "object" && i !== null && v3DMCSchema.safeParse(i).success,
    v3DMS: (i: unknown): i is V3MetadataBody<"dms"> =>
      typeof i === "object" && i !== null && v3DMSSchema.safeParse(i).success,
  },
  renderer: {
    progress: (i: unknown): i is ApiResponseProgress =>
      typeof i === "object" &&
      i !== null &&
      progressSchema.safeParse(i).success,
    end: (i: unknown): i is ApiResponseEnd =>
      typeof i === "object" && i !== null && endSchema.safeParse(i).success,
    reportProgress: (i: unknown): i is ApiResponseReportProgress =>
      typeof i === "object" &&
      i !== null &&
      reportProgressSchema.safeParse(i).success,
  },
  binaryDownloader: {
    progress: (i: unknown): i is ApiResponseDownloadProgress =>
      typeof i === "object" &&
      i !== null &&
      downloadProgressSchema.safeParse(i).success,
  },
};

export { typeGuard };
