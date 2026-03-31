import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { Readable } from "node:stream";
import type { ReadableStream } from "node:stream/web";
import type { Dispatcher } from "undici";
import { EnvHttpProxyAgent } from "undici";
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
let proxyDispatcher: Dispatcher | undefined;
const getFetchInit = (): RequestInit => {
  if (
    !process.env.HTTP_PROXY &&
    !process.env.HTTPS_PROXY &&
    !process.env.http_proxy &&
    !process.env.https_proxy
  ) {
    return {};
  }
  if (!proxyDispatcher) {
    try {
      proxyDispatcher = new EnvHttpProxyAgent();
    } catch (error) {
      console.warn("Failed to initialize proxy agent:", error);
      return {};
    }
  }
  return { dispatcher: proxyDispatcher } as RequestInit;
};

const assetsBaseUrl = {
  ffmpeg:
    "https://github.com/descriptinc/ffmpeg-ffprobe-static/releases/download/b6.1.2-rc.1/",
};
const version = {
  ffmpeg: "6.1",
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

const isValidBinary = async (
  path: string,
  version: string,
): Promise<boolean> => {
  try {
    if (!fs.existsSync(path)) {
      return false;
    }
    const result = await spawn(path, ["-version"]).promise;
    return result.stdout.includes(version);
  } catch (e) {
    console.warn(e);
    return false;
  }
};

const onStartUp = async (): Promise<void> => {
  target = [];
  if (!(await isValidBinary(ffmpegPath, version.ffmpeg))) {
    target.push("ffmpeg");
  }
  if (!(await isValidBinary(ffprobePath, version.ffmpeg))) {
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
  let response: Response;
  try {
    response = await fetch(url, getFetchInit());
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to download ${name}: ${message}`, { cause: error });
  }
  if (!response.ok || !response.body) {
    throw new Error(
      `Failed to download ${name}: ${response.status} ${response.statusText}`,
    );
  }
  const file = fs.createWriteStream(path);
  const totalRaw = Number(response.headers.get("content-length"));
  const total =
    Number.isFinite(totalRaw) && Number.isInteger(totalRaw) && totalRaw > 0
      ? totalRaw
      : undefined;
  const canReportProgress = total !== undefined;
  let loaded = 0;
  const stream = Readable.fromWeb(response.body as ReadableStream<Uint8Array>);
  stream.on("data", (chunk: Buffer) => {
    loaded += chunk.byteLength;
    if (!canReportProgress) return;
    sendMessageToBinaryDownloader({
      type: "downloadProgress",
      name: name,
      progress: loaded / total,
    });
  });
  return new Promise<void>((resolve, reject) => {
    stream.pipe(file);
    let settled = false;
    const rejectOnce = (err: Error): void => {
      if (settled) return;
      settled = true;
      stream.destroy();
      file.destroy();
      void fs.promises
        .unlink(path)
        .catch((unlinkError: NodeJS.ErrnoException) => {
          if (unlinkError.code !== "ENOENT" && unlinkError.code !== "EBUSY") {
            console.warn(
              `Failed to clean up partial download file at ${path}:`,
              unlinkError,
            );
          }
        });
      reject(err);
    };
    stream.on("error", rejectOnce);
    file.on("error", rejectOnce);
    file.on("close", () => {
      if (settled) return;
      settled = true;
      if (canReportProgress) {
        sendMessageToBinaryDownloader({
          type: "downloadProgress",
          name: name,
          progress: 1,
        });
      }
      resolve();
    });
  });
};
export { ffmpegPath, ffprobePath, onStartUp };
