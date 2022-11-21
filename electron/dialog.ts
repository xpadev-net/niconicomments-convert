import { dialog } from "electron";
import { spawn } from "./lib/spawn";
import { ffprobe as ffprobePath } from "./ffmpeg";
import { setCommentData, setDuration, setInputPath } from "./context";
import * as fs from "fs";
import { typeGuard } from "./typeGuard";
import { sendMessageToController } from "./controllerWindow";

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
    sendMessageToController({
      type: "selectMovie",
      message: `
<div>input file is not movie(fail to execute ffprobe)</div>
<div>code:<pre><code>${e.code}</code></pre></div>
<div>stdout:<pre><code>${e.stdout}</code></pre></div>
<div>stdout:<pre><code>${e.stderr}</code></pre></div>`,
    });
    return;
  }
  try {
    metadata = JSON.parse(ffprobe.stdout) as ffmpegOutput;
  } catch (e) {
    sendMessageToController({
      type: "selectMovie",
      message: `
<div>input file is not movie(fail to parse ffprobe output)</div>
<div>Error:<pre><code>${JSON.stringify(e)}</code></pre></div>`,
    });
    return;
  }
  if (!metadata.streams || !Array.isArray(metadata.streams)) {
    sendMessageToController({
      type: "selectMovie",
      message: "input file is not movie(stream not found)",
    });
    return;
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
    sendMessageToController({
      type: "selectMovie",
      message:
        "input file is not movie(fail to get resolution or duration from input file)",
    });
    return;
  }
  setInputPath(path.filePaths[0]);
  setDuration(duration);
  sendMessageToController({
    type: "selectMovie",
    data: { path, width, height, duration },
  });
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
    data = fileData;
    type = "niconicome";
  } else if (file.match(/\.txt$/)) {
    data = fileData;
    type = "legacyOwner";
  } else if (file.match(/\.json$/)) {
    const json = JSON.parse(fileData) as unknown;
    if (
      (json as v1Raw)?.meta?.status === 200 &&
      typeGuard.v1.threads((json as v1Raw)?.data?.threads)
    ) {
      data = (json as v1Raw).data.threads;
      type = "v1";
    } else {
      if (typeGuard.v1.threads(json)) {
        type = "v1";
      } else if (typeGuard.legacy.rawApiResponses(json)) {
        type = "legacy";
      } else if (typeGuard.owner.comments(json)) {
        type = "owner";
      } else if (
        typeGuard.formatted.comments(json) ||
        typeGuard.formatted.legacyComments(json)
      ) {
        type = "formatted";
      } else {
        return;
      }
      data = json;
    }
  } else {
    sendMessageToController({
      type: "message",
      message: `unknown input format`,
    });
    return;
  }

  setCommentData({
    type,
    data,
  });
  sendMessageToController({
    type: "selectComment",
    data: data,
    format: type,
  });
};

export { selectComment, selectMovie };
