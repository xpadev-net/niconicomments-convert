import type { OpenDialogReturnValue, SaveDialogOptions } from "electron";
import { dialog } from "electron";

import type { FfprobeOutput } from "@/@types/ffmpeg";
import type {
  ApiResponseMessage,
  ApiResponseSelectComment,
  ApiResponseSelectMovie,
} from "@/@types/response.controller";
import type { SpawnResult } from "@/@types/spawn";

import { sendMessageToController } from "./controllerWindow";
import { ffprobePath } from "./ffmpeg";
import { encodeJson } from "./lib/json";
import { spawn } from "./lib/spawn";
import { identifyCommentFormat } from "./utils/niconicomments";

const selectFile = async (
  pattern: Electron.FileFilter[],
): Promise<OpenDialogReturnValue> => {
  return await dialog.showOpenDialog({
    properties: ["openFile"],
    filters: pattern,
  });
};

const selectMovie = async (): Promise<
  ApiResponseMessage | ApiResponseSelectMovie | void
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
    return {
      type: "message",
      title: "動画ファイルの解析に失敗しました",
      message: `ffprobeの実行に失敗しました\n終了コード:\n${error.code}\n標準出力:\n${error.stdout}\n標準エラー出力:\n${error.stderr}\ndialog / selectMovie / failed to execute ffprobe`,
    };
  }
  try {
    metadata = JSON.parse(ffprobe.stdout) as FfprobeOutput;
  } catch (e) {
    return {
      type: "message",
      title: "動画ファイルの解析に失敗しました",
      message: `ffprobeの出力のパースに失敗しました\nffprobeの出力:\n${
        ffprobe.stdout
      }\nエラー内容:\n${encodeJson(
        e,
      )}\ndialog / selectMovie / failed to parse ffprobe output`,
    };
  }
  if (!metadata.streams || !Array.isArray(metadata.streams)) {
    return {
      type: "message",
      title: "動画ファイルの解析に失敗しました",
      message:
        "動画ソースが見つかりませんでした\ndialog / selectMovie / empty streams",
    };
  }
  let width: number = 0,
    height: number = 0,
    duration: number = 0;
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
  const path = await dialog.showOpenDialog({
    properties: ["openFile"],
    filters: [
      { name: "formatted/legacy/v1/owner JSON", extensions: ["json"] },
      { name: "niconicome XML", extensions: ["xml"] },
      { name: "legacyOwner TXT", extensions: ["txt"] },
      {
        name: "All Files",
        extensions: ["*"],
      },
    ],
  });
  if (path.canceled) return;
  const filePath = path.filePaths[0];
  const format = identifyCommentFormat(filePath);
  if (!format) {
    sendMessageToController({
      type: "message",
      title: "非対応のフォーマットです",
      message: `入力されたデータの識別に失敗しました\n対応していないフォーマットの可能性があります\n対応しているフォーマットについては以下のリンクを御覧ください\nhttps://xpadev-net.github.io/niconicomments/#p_format\n※フォーマットの識別は拡張子をもとに行っています\ndialog / selectComment`,
    });
    return;
  }
  return {
    type: "selectComment",
    path: path.filePaths[0],
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
