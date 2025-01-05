import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type * as Stream from "node:stream";
import type { AxiosProgressEvent, AxiosResponse } from "axios";
import axios from "axios";

import {
  closeBinaryDownloaderWindow,
  createBinaryDownloaderWindow,
  sendMessageToBinaryDownloader,
} from "./binary-downloader-window";
import { basePath } from "./context";
import { spawn } from "./lib/spawn";

type lib = "ffmpeg" | "ffprobe";

let target: lib[] = [];

const ext = process.platform === "win32" ? ".exe" : "";

const binPath = path.join(basePath, "bin");
const ffmpegPath = path.join(binPath, `ffmpeg${ext}`);
const ffprobePath = path.join(binPath, `ffprobe${ext}`);

const assetsBaseUrl = {
  ffmpeg:
    "https://github.com/descriptinc/ffmpeg-ffprobe-static/releases/download/b6.1.2-rc.1/",
};
const version = {
  ffmpeg: "6.1.1",
};
const distro = (() => {
  const arch = os.arch();
  const dist = process.platform;
  if (dist === "win32" && arch === "x64") {
    return {
      ffmpeg: "win32-x64",
    };
  }
  if (dist === "darwin" && arch === "arm64") {
    return {
      ffmpeg: "darwin-arm64",
    };
  }
  if (dist === "darwin" && arch === "x64") {
    return {
      ffmpeg: "darwin-x64",
    };
  }
  throw new Error("unknown os or architecture");
})();

const onStartUp = async (): Promise<void> => {
  target = [];
  if (
    !fs.existsSync(ffmpegPath) ||
    !(await spawn(ffmpegPath, ["-version"]).promise).stdout.includes(
      version.ffmpeg,
    )
  ) {
    target.push("ffmpeg");
  }
  if (
    !fs.existsSync(ffprobePath) ||
    !(await spawn(ffprobePath, ["-version"]).promise).stdout.includes(
      version.ffmpeg,
    )
  ) {
    target.push("ffprobe");
  }
  if (target.length === 0) return;
  await createBinaryDownloaderWindow();
  await downloadBinary(target);
  closeBinaryDownloaderWindow();
};

const downloadBinary = async (target: lib[]): Promise<void> => {
  if (!fs.existsSync(binPath)) {
    await fs.promises.mkdir(binPath, { recursive: true });
  }
  if (target.includes("ffmpeg")) {
    await downloadFile(
      "ffmpeg",
      `${assetsBaseUrl.ffmpeg}ffmpeg-${distro.ffmpeg}`,
      ffmpegPath,
    );
  }
  if (target.includes("ffprobe")) {
    await downloadFile(
      "ffprobe",
      `${assetsBaseUrl.ffmpeg}ffprobe-${distro.ffmpeg}`,
      ffprobePath,
    );
  }
  if (process.platform === "darwin") {
    fs.chmodSync(ffmpegPath, 0o755);
    fs.chmodSync(ffprobePath, 0o755);
  }
};
const downloadFile = async (
  name: string,
  url: string,
  path: string,
): Promise<void> => {
  const file = fs.createWriteStream(path);
  const onDownloadProgress = (status: AxiosProgressEvent): void => {
    const progress = status.loaded / (status.total ?? 1);
    sendMessageToBinaryDownloader({
      type: "downloadProgress",
      name: name,
      progress: progress,
    });
  };
  return axios({
    method: "get",
    url,
    responseType: "stream",
    onDownloadProgress,
  }).then((res: AxiosResponse<Stream>) => {
    return new Promise<void>((resolve, reject) => {
      res.data.pipe(file);
      let error: Error;
      file.on("error", (err) => {
        error = err;
        file.close();
        reject(err);
      });
      file.on("close", () => {
        if (!error) {
          resolve();
        }
      });
    });
  });
};
export { ffmpegPath, ffprobePath, onStartUp };
