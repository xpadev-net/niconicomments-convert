import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream } from "node:stream/web";
import type { Dispatcher } from "undici";
import { EnvHttpProxyAgent } from "undici";
import {
  closeBinaryDownloaderWindow,
  createBinaryDownloaderWindow,
  sendMessageToBinaryDownloader,
} from "./binary-downloader-window";
import { binPath } from "./context";
import { spawn } from "./lib/spawn";

type lib = "ffmpeg" | "ffprobe";

const ext = process.platform === "win32" ? ".exe" : "";

const ffmpegPath = path.join(binPath, `ffmpeg${ext}`);
const ffprobePath = path.join(binPath, `ffprobe${ext}`);
let proxyDispatcher: Dispatcher | undefined;
type UndiciRequestInit = RequestInit & { dispatcher?: Dispatcher };
// proxyDispatcher is intentionally cached for the process lifetime.
// Proxy env-var changes after first use are not reflected.
const getFetchInit = (): UndiciRequestInit => {
  if (
    !process.env.HTTP_PROXY &&
    !process.env.HTTPS_PROXY &&
    !process.env.http_proxy &&
    !process.env.https_proxy &&
    !process.env.ALL_PROXY &&
    !process.env.all_proxy
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
  return { dispatcher: proxyDispatcher };
};

const assetsBaseUrl = {
  ffmpeg:
    "https://github.com/descriptinc/ffmpeg-ffprobe-static/releases/download/b6.1.2-rc.1/",
};
const version = {
  ffmpeg: "6.1",
};
const getDistro = (): string => {
  const arch = os.arch();
  const dist = process.platform;
  if (dist === "win32" && arch === "x64") {
    return "win32-x64";
  }
  if (dist === "darwin" && arch === "arm64") {
    return "darwin-arm64";
  }
  if (dist === "darwin" && arch === "x64") {
    return "darwin-x64";
  }
  throw new Error("unknown os or architecture");
};

const isValidBinary = async (
  path: string,
  version: string,
  signal: AbortSignal,
): Promise<boolean> => {
  signal.throwIfAborted();
  try {
    if (!fs.existsSync(path)) {
      return false;
    }
    const result = await spawn(path, ["-version"], {
      signal,
      timeout: 10_000,
    }).promise;
    return result.stdout.includes(version);
  } catch (e) {
    signal.throwIfAborted();
    console.warn(e);
    return false;
  }
};

const onStartUp = async (signal: AbortSignal): Promise<void> => {
  const target: lib[] = [];
  if (!(await isValidBinary(ffmpegPath, version.ffmpeg, signal))) {
    target.push("ffmpeg");
  }
  if (!(await isValidBinary(ffprobePath, version.ffmpeg, signal))) {
    target.push("ffprobe");
  }
  if (target.length === 0) return;
  try {
    await createBinaryDownloaderWindow();
    signal.throwIfAborted();
    await downloadBinary(target, signal);
  } finally {
    closeBinaryDownloaderWindow();
  }
};

const downloadBinary = async (
  target: lib[],
  signal: AbortSignal,
): Promise<void> => {
  const distro = getDistro();
  await fs.promises.mkdir(binPath, { recursive: true });
  for (const name of target) {
    await downloadFile(
      name,
      `${assetsBaseUrl.ffmpeg}${name}-${distro}`,
      name === "ffmpeg" ? ffmpegPath : ffprobePath,
      signal,
    );
  }
};
const downloadFile = async (
  name: string,
  url: string,
  path: string,
  signal: AbortSignal,
): Promise<void> => {
  let response: Response;
  try {
    response = await fetch(url, { ...getFetchInit(), signal });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to download ${name}: ${message}`, { cause: error });
  }
  if (!response.ok || !response.body) {
    throw new Error(
      `Failed to download ${name}: ${response.status} ${response.statusText}`,
    );
  }
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
      progress: Math.min(loaded / total, 1),
    });
  });
  const temporaryPath = `${path}.part${ext}`;
  try {
    await pipeline(stream, fs.createWriteStream(temporaryPath), { signal });
    if (process.platform === "darwin") {
      await fs.promises.chmod(temporaryPath, 0o755);
    }
    if (!(await isValidBinary(temporaryPath, version.ffmpeg, signal))) {
      throw new Error(`Downloaded ${name} failed version validation`);
    }
    signal.throwIfAborted();
    await fs.promises.rename(temporaryPath, path);
    sendMessageToBinaryDownloader({
      type: "downloadProgress",
      name,
      progress: 1,
    });
  } finally {
    await fs.promises.rm(temporaryPath, { force: true }).catch((error) => {
      console.warn(
        `Failed to clean up partial download at ${temporaryPath}:`,
        error,
      );
    });
  }
};

export { ffmpegPath, ffprobePath, onStartUp };
