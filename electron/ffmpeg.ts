import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { https } from "follow-redirects";
import {
  createDownloaderWindow,
  downloaderWindow,
  sendMessageToDownloader,
} from "./downloaderWindow";
import { app } from "electron";

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
    await createDownloaderWindow();
    await downloadBinary();
    downloaderWindow.close();
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
  return new Promise<void>((resolve, reject) => {
    sendMessageToDownloader({
      type: "downloadProgress",
      step: step,
      progress: (step - 1) / 3,
    });
    const file = fs.createWriteStream(path);

    const request = https
      .get(url)
      .on("response", (response) => {
        if (response.statusCode !== 200) {
          fs.unlink(path, () => {
            console.log(`Failed to get '${url}' (${response.statusCode})`);
            reject(
              new Error(`Failed to get '${url}' (${response.statusCode})`)
            );
          });
          return;
        }
        response.pipe(file);
      })
      .on("error", () => {
        fs.unlink(path, () => reject());
      });

    file.on("finish", () => resolve());

    file.on("error", () => {
      fs.unlink(path, () => reject());
    });

    request.end();
  });
};
export { onStartUp, ffmpegPath, ffprobePath, ytdlpPath };
