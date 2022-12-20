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

const selectMovie = async () => {
  const path = await dialog.showOpenDialog({
    properties: ["openFile"],
    filters: [
      {
        name: "Movies",
        extensions: ["mp4", "webm", "avi", "mkv", "wmv", "mov"],
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
  } catch (e) {
    return {
      type: "message",
      title: "input file is not movie",
      message: `fail to execute ffprobe
code:${e.code}
stdout:${e.stdout}
stdout:${e.stderr}`,
    };
  }
  try {
    metadata = JSON.parse(ffprobe.stdout) as ffmpegOutput;
  } catch (e) {
    return {
      type: "message",
      title: "input file is not movie",
      message: `fail to parse ffprobe output
Error:${JSON.stringify(e)}`,
    };
  }
  if (!metadata.streams || !Array.isArray(metadata.streams)) {
    return {
      type: "message",
      title: "input file is not movie",
      message: "stream not found",
    };
  }
  let width, height, duration;
  for (const key in metadata.streams) {
    const stream = metadata.streams[key];
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
      title: "input file is not movie",
      message: "fail to get resolution or duration from input file",
    };
  }
  return {
    type: "selectMovie",
    data: { path, width, height, duration },
  };
};
const selectComment = async () => {
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
      type = "niconicome";
    } else {
      sendMessageToController({
        type: "message",
        message: `unknown input format`,
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
          message: `unknown input format`,
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
      message: `unknown input format`,
    });
    return;
  }
  return {
    type: "selectComment",
    data: data,
    format: type,
  };
};

const selectOutput = async () => {
  const outputPath = await dialog.showSaveDialog({
    filters: [{ name: "mp4", extensions: ["mp4"] }],
    properties: ["createDirectory"],
  });
  return outputPath.canceled ? undefined : outputPath.filePath;
};

export { selectComment, selectMovie, selectOutput };
