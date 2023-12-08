import type { SpawnResult } from "@/@types/spawn";

import { ffmpegPath } from "../assets";
import { spawn } from "../lib/spawn";
import { time2num } from "./time";

const DownloadM3U8 = (
  args: string[],
  progress: (total: number, downloaded: number, eta: number) => void,
): {
  stop: () => void;
  promise: Promise<SpawnResult>;
} => {
  let total = 0,
    downloaded = 0,
    speed = -1;
  const onData = (data: string): void => {
    let match;
    if ((match = data.match(/Duration: ([0-9:.]+),/))) {
      total = time2num(match[1]);
    }
    if ((match = data.match(/time=([0-9:.]+) /))) {
      downloaded = time2num(match[1]);
    }
    if ((match = data.match(/speed=([0-9.]+)x /))) {
      speed = Number(match[1]);
    }
    const eta = speed < 0 ? -1 : (total - downloaded) / speed;
    progress(total, downloaded, eta);
  };
  const _spawn = spawn(ffmpegPath, args, undefined, onData, onData);
  const stop = (): void => {
    _spawn.stop();
  };
  return { stop, promise: _spawn.promise };
};

export { DownloadM3U8 };
