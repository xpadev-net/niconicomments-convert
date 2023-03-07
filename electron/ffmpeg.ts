import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import {
  createBinaryDownloaderWindow,
  binaryDownloaderWindow,
  sendMessageToBinaryDownloader,
} from "./binaryDownloaderWindow";
import { app } from "electron";
import axios, { AxiosResponse } from "axios";
import * as Stream from "stream";
import { spawn } from "./lib/spawn";

type lib = "ffmpeg" | "ffprobe";

let step = 0,
  target: lib[] = [];

const ext = process.platform === "win32" ? ".exe" : "";

const basePath = path.join(__dirname, app.isPackaged ? "../../../" : "", "bin"),
  ffmpegPath = path.join(basePath, `ffmpeg${ext}`),
  ffprobePath = path.join(basePath, `ffprobe${ext}`);

const baseUrl = {
  ffmpeg:
    "https://github.com/descriptinc/ffmpeg-ffprobe-static/releases/download/b4.4.0-rc.11/",
};
const version = {
  ffmpeg: "4.4",
};
const distro = (function () {
  const arch = os.arch();
  const dist = process.platform;
  if (dist === "win32" && arch === "x64") {
    return {
      ffmpeg: "win32-x64",
    };
  } else if (dist === "darwin" && arch === "arm64") {
    return {
      ffmpeg: "darwin-arm64",
    };
  } else if (dist === "darwin" && arch === "x64") {
    return {
      ffmpeg: "darwin-x64",
    };
  }
  throw new Error("unknown os or architecture");
})();

const onStartUp = async () => {
  target = [];
  if (
    !fs.existsSync(ffmpegPath) ||
    !(await spawn(ffmpegPath, ["-version"])).stdout.includes(version.ffmpeg)
  ) {
    target.push("ffmpeg");
  }
  if (
    !fs.existsSync(ffprobePath) ||
    !(await spawn(ffprobePath, ["-version"])).stdout.includes(version.ffmpeg)
  ) {
    target.push("ffprobe");
  }
  if (target.length === 0) return;
  await createBinaryDownloaderWindow();
  await downloadBinary(target);
  binaryDownloaderWindow.close();
};

const downloadBinary = async (target: lib[]) => {
  if (!fs.existsSync(basePath)) {
    await fs.promises.mkdir(basePath, { recursive: true });
  }
  if (target.includes("ffmpeg")) {
    step++;
    await downloadFile(`${baseUrl.ffmpeg}ffmpeg-${distro.ffmpeg}`, ffmpegPath);
  }
  if (target.includes("ffprobe")) {
    step++;
    await downloadFile(
      `${baseUrl.ffmpeg}ffprobe-${distro.ffmpeg}`,
      ffprobePath
    );
  }
  if (process.platform === "darwin") {
    fs.chmodSync(ffmpegPath, 0o755);
    fs.chmodSync(ffprobePath, 0o755);
  }
};
const downloadFile = async (url: string, path: string) => {
  const file = fs.createWriteStream(path);
  return axios({
    method: "get",
    url,
    responseType: "stream",
    onDownloadProgress: (progress) => {
      sendMessageToBinaryDownloader({
        type: "downloadProgress",
        step: step,
        progress:
          (step - 1 + progress.loaded / (progress.total || 1)) / target.length,
      });
    },
  }).then((res: AxiosResponse<Stream>) => {
    return new Promise<void>((resolve, reject) => {
      res.data.pipe(file);
      let error: Error;
      file.on("error", (err) => {
        error = err;
        file.close();
        reject();
      });
      file.on("close", () => {
        if (!error) {
          resolve();
        }
      });
    });
  });
};
export { onStartUp, ffmpegPath, ffprobePath };
