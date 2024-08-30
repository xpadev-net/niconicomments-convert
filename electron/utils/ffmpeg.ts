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
  let total = 0;
  let downloaded = 0;
  let speed = -1;
  const onData = (data: string): void => {
    let match: RegExpMatchArray | null = data.match(/Duration: ([0-9:.]+),/);
    if (match) {
      total = time2num(match[1]);
    }
    match = data.match(/time=([0-9:.]+) /);
    if (match) {
      downloaded = time2num(match[1]);
    }
    match = data.match(/speed=([0-9.]+)x /);
    if (match) {
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
