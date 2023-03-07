import { dialog } from "electron";
import { spawn } from "./lib/spawn";
import { ffprobePath } from "./ffmpeg";
import * as fs from "fs";
import { sendMessageToController } from "./controllerWindow";
import NiconiComments from "@xpadev-net/niconicomments";
import { JSDOM } from "jsdom";
import { v1Raw } from "@/@types/types";
import { spawnResult } from "@/@types/spawn";
import { ffmpegOutput } from "@/@types/ffmpeg";
import SaveDialogOptions = Electron.SaveDialogOptions;
import { encodeJson } from "./lib/json";

const selectFile = async (pattern: Electron.FileFilter[]) => {
  return await dialog.showOpenDialog({
    properties: ["openFile"],
    filters: pattern,
  });
};

const selectMovie = async () => {
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
  let ffprobe: spawnResult;
  let metadata;
  try {
    ffprobe = await spawn(ffprobePath, [
      path.filePaths[0],
      "-hide_banner",
      "-v",
      "quiet",
      "-print_format",
      "json",
      "-show_streams",
    ]);
  } catch (e: unknown) {
    const error = e as spawnResult;
    return {
      type: "message",
      title: "動画ファイルの解析に失敗しました",
      message: `ffprobeの実行に失敗しました\n終了コード:\n${error.code}\n標準出力:\n${error.stdout}\n標準エラー出力:\n${error.stderr}`,
    };
  }
  try {
    metadata = JSON.parse(ffprobe.stdout) as ffmpegOutput;
  } catch (e) {
    return {
      type: "message",
      title: "動画ファイルの解析に失敗しました",
      message: `ffprobeの出力のパースに失敗しました\nffprobeの出力:\n${
        ffprobe.stdout
      }\nエラー内容:\n${encodeJson(e)}`,
    };
  }
  if (!metadata.streams || !Array.isArray(metadata.streams)) {
    return {
      type: "message",
      title: "動画ファイルの解析に失敗しました",
      message: "動画ソースが見つかりませんでした",
    };
  }
  let width, height, duration;
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
        "解像度または動画の長さを取得できませんでした\n動画ファイルが破損していないか確認してください",
    };
  }
  return {
    type: "selectMovie",
    data: { path, width, height, duration },
  };
};
const selectComment = async () => {
  const documentLink =
    "対応しているフォーマットについては以下のリンクを御覧ください\nhttps://xpadev-net.github.io/niconicomments/#p_format\n※フォーマットの識別は拡張子をもとに行っています";
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
  const file = path.filePaths[0];
  const fileData = fs.readFileSync(file, "utf8");
  let data, type;
  if (file.match(/\.xml$/)) {
    const jsdom = new JSDOM();
    const parser = new jsdom.window.DOMParser();
    const dom = parser.parseFromString(fileData, "application/xhtml+xml");
    if (NiconiComments.typeGuard.xmlDocument(dom)) {
      data = fileData;
      type = "XMLDocument";
    } else {
      sendMessageToController({
        type: "message",
        title: "非対応のフォーマットです",
        message: `入力されたデータの識別に失敗しました\nXMLはniconicomeの形式に準拠しています\nそれ以外のツールを使用したい場合は開発者までお問い合わせください\n推奨形式はv1形式のjsonファイルです\n${documentLink}`,
      });
      return;
    }
  } else if (file.match(/\.json$/) || file.match(/_commentJSON\.txt$/)) {
    const json = JSON.parse(fileData) as unknown;
    if (
      (json as v1Raw)?.meta?.status === 200 &&
      NiconiComments.typeGuard.v1.threads((json as v1Raw)?.data?.threads)
    ) {
      data = (json as v1Raw).data.threads;
      type = "v1";
    } else {
      if (NiconiComments.typeGuard.v1.threads(json)) {
        type = "v1";
      } else if (NiconiComments.typeGuard.legacy.rawApiResponses(json)) {
        type = "legacy";
      } else if (NiconiComments.typeGuard.owner.comments(json)) {
        type = "owner";
      } else if (
        NiconiComments.typeGuard.formatted.comments(json) ||
        NiconiComments.typeGuard.formatted.legacyComments(json)
      ) {
        type = "formatted";
      } else {
        sendMessageToController({
          type: "message",
          title: "非対応のフォーマットです",
          message: `入力されたデータの識別に失敗しました\n対応していないフォーマットの可能性があります\n${documentLink}`,
        });
        return;
      }
      data = json;
    }
  } else if (file.match(/\.txt$/)) {
    data = fileData;
    type = "legacyOwner";
  } else {
    sendMessageToController({
      type: "message",
      title: "非対応のフォーマットです",
      message: `入力されたデータの識別に失敗しました\n対応していないフォーマットの可能性があります\n${documentLink}`,
    });
    return;
  }
  return {
    type: "selectComment",
    data: data,
    format: type,
  };
};

const selectOutput = async (options: SaveDialogOptions) => {
  const outputPath = await dialog.showSaveDialog(options);
  return outputPath.canceled ? undefined : outputPath.filePath;
};

export { selectComment, selectMovie, selectOutput, selectFile };
