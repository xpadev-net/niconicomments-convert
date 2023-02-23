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

const ext = process.platform === "win32" ? ".exe" : "";

const basePath = path.join(__dirname, app.isPackaged ? "../../../" : "", "bin"),
  ffmpegPath = path.join(basePath, `ffmpeg${ext}`),
  ffprobePath = path.join(basePath, `ffprobe${ext}`),
  ytdlpPath = path.join(basePath, `yt-dlp${ext}`);

const baseUrl = {
  ffmpeg:
    "https://github.com/descriptinc/ffmpeg-ffprobe-static/releases/download/b4.4.0-rc.11/",
  ytdlp: "https://github.com/yt-dlp/yt-dlp/releases/download/2022.11.11/",
};
const distro = (function () {
  const arch = os.arch();
  const dist = process.platform;
  if (dist === "win32" && arch === "x64") {
    return {
      ffmpeg: "win32-x64",
      ytdlp: "yt-dlp.exe",
    };
  } else if (dist === "darwin" && arch === "arm64") {
    return {
      ffmpeg: "darwin-arm64",
      ytdlp: "yt-dlp_macos",
    };
  } else if (dist === "darwin" && arch === "x64") {
    return {
      ffmpeg: "darwin-x64",
      ytdlp: "yt-dlp_macos",
    };
  }
  throw new Error("unknown os or architecture");
})();

const onStartUp = async () => {
  if (
    !(
      fs.existsSync(ffmpegPath) &&
      fs.existsSync(ffprobePath) &&
      fs.existsSync(ytdlpPath)
    )
  ) {
    await createBinaryDownloaderWindow();
    await downloadBinary();
    binaryDownloaderWindow.close();
  }
};

const downloadBinary = async () => {
  if (!fs.existsSync(basePath)) {
    await fs.promises.mkdir(basePath, { recursive: true });
  }
  await downloadFile(`${baseUrl.ffmpeg}ffmpeg-${distro.ffmpeg}`, ffmpegPath, 1);
  await downloadFile(
    `${baseUrl.ffmpeg}ffprobe-${distro.ffmpeg}`,
    ffprobePath,
    2
  );
  await downloadFile(`${baseUrl.ytdlp}${distro.ytdlp}`, ytdlpPath, 3);
  if (process.platform === "darwin") {
    fs.chmodSync(ffmpegPath, 0o755);
    fs.chmodSync(ffprobePath, 0o755);
    fs.chmodSync(ytdlpPath, 0o755);
  }
};
const downloadFile = async (url: string, path: string, step: number) => {
  const file = fs.createWriteStream(path);
  return axios({
    method: "get",
    url,
    responseType: "stream",
    onDownloadProgress: (progress) => {
      sendMessageToBinaryDownloader({
        type: "downloadProgress",
        step: step,
        progress: (step - 1 + progress.loaded / (progress.total || 1)) / 3,
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
export { onStartUp, ffmpegPath, ffprobePath, ytdlpPath };
