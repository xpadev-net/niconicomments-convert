import * as path from "node:path";
import type { OpenDialogReturnValue, SaveDialogOptions } from "electron";
import { dialog } from "electron";

import type { FfprobeOutput } from "@/@types/ffmpeg";
import type {
  ApiResponseMessage,
  ApiResponseSelectComment,
  ApiResponseSelectMovie,
} from "@/@types/response.controller";
import type { SpawnResult } from "@/@types/spawn";

import { ffprobePath } from "./assets";
import { sendMessageToController } from "./controller-window";
import { encodeError } from "./lib/json";
import { getLogger } from "./lib/log";
import { spawn } from "./lib/spawn";
import { store } from "./store";
import { identifyCommentFormat } from "./utils/niconicomments";

const logger = getLogger("[dialog]");

const selectFile = async (
  pattern: Electron.FileFilter[],
): Promise<OpenDialogReturnValue> => {
  return await dialog.showOpenDialog({
    properties: ["openFile"],
    filters: pattern,
  });
};

const selectMovie = async (): Promise<
  ApiResponseMessage | ApiResponseSelectMovie | undefined
> => {
  const path = await dialog.showOpenDialog({
    properties: ["openFile"],
    filters: [
      {
        name: "Movies",
        extensions: ["mp4", "webm", "avi", "mkv", "wmv", "mov", "ts", "m2ts"],
      },
      {
        name: "All Files",
        extensions: ["*"],
      },
    ],
  });
  if (path.canceled) {
    return;
  }
  let ffprobe: SpawnResult;
  let metadata: FfprobeOutput;
  try {
    ffprobe = await spawn(ffprobePath, [
      path.filePaths[0],
      "-hide_banner",
      "-v",
      "quiet",
      "-print_format",
      "json",
      "-show_streams",
    ]).promise;
  } catch (e: unknown) {
    const error = e as SpawnResult;
    logger.error("failed to execute ffprobe", "error:", error);
    return {
      type: "message",
      title: "動画ファイルの解析に失敗しました",
      message: `ffprobeの実行に失敗しました\n終了コード:\n${error.code}\n標準出力:\n${error.stdout}\n標準エラー出力:\n${error.stderr}\ndialog / selectMovie / failed to execute ffprobe`,
    };
  }
  try {
    metadata = JSON.parse(ffprobe.stdout) as FfprobeOutput;
  } catch (e) {
    logger.error(
      "failed to parse ffprobe output",
      "error:",
      e,
      "stdout:",
      ffprobe.stdout,
    );
    return {
      type: "message",
      title: "動画ファイルの解析に失敗しました",
      message: `ffprobeの出力のパースに失敗しました\nffprobeの出力:\n${
        ffprobe.stdout
      }\nエラー内容:\n${encodeError(
        e,
      )}\ndialog / selectMovie / failed to parse ffprobe output`,
    };
  }
  if (!metadata.streams || !Array.isArray(metadata.streams)) {
    logger.error("movie source not found", "metadata:", metadata);
    return {
      type: "message",
      title: "動画ファイルの解析に失敗しました",
      message:
        "動画ソースが見つかりませんでした\ndialog / selectMovie / empty streams",
    };
  }
  let width = 0;
  let height = 0;
  let duration = 0;
  for (const stream of metadata.streams) {
    if (stream.width) {
      width = stream.width;
    }
    if (stream.height) {
      height = stream.height;
    }
    if (stream.duration) {
      duration = stream.duration;
    }
  }
  if (!(height && width && duration)) {
    logger.error("failed to get resolution or duration", "metadata:", metadata);
    return {
      type: "message",
      title: "動画ファイルの解析に失敗しました",
      message:
        "解像度または動画の長さを取得できませんでした\n動画ファイルが破損していないか確認してください\ndialog / selectMovie / incorrect input file",
    };
  }
  return {
    type: "selectMovie",
    data: { path, width, height, duration },
  };
};
const selectComment = async (): Promise<
  ApiResponseSelectComment | undefined
> => {
  const lastExt = `${store.get("commentFileExt")}`;
  const formats = [
    { name: "formatted/legacy/v1/owner JSON", extensions: ["json"] },
    { name: "niconicome XML", extensions: ["xml"] },
    { name: "legacyOwner TXT", extensions: ["txt"] },
    {
      name: "All Files",
      extensions: ["*"],
    },
  ].sort((item) => {
    return item.extensions.includes(lastExt.slice(1)) ? -1 : 0;
  });
  const pathResult = await dialog.showOpenDialog({
    properties: ["openFile"],
    filters: formats,
  });
  if (pathResult.canceled) return;
  const filePath = pathResult.filePaths[0];
  const ext = path.extname(filePath);
  store.set("commentFileExt", ext);
  const format = await identifyCommentFormat(filePath);
  if (!format) {
    console.error("failed to identify comment format", "filePath:", filePath);
    sendMessageToController({
      type: "message",
      title: "非対応のフォーマットです",
      message:
        "入力されたデータの識別に失敗しました\n対応していないフォーマットの可能性があります\n対応しているフォーマットについては以下のリンクを御覧ください\nhttps://xpadev-net.github.io/niconicomments/#p_format\n※フォーマットの識別は拡張子をもとに行っています\ndialog / selectComment",
    });
    return;
  }
  return {
    type: "selectComment",
    path: pathResult.filePaths[0],
    format: format,
  };
};

const selectOutput = async (
  options: SaveDialogOptions,
): Promise<string | undefined> => {
  const outputPath = await dialog.showSaveDialog(options);
  return outputPath.canceled ? undefined : outputPath.filePath;
};

export { selectComment, selectFile, selectMovie, selectOutput };
