import { spawn } from "./spawn";
import { ytdlpPath } from "../ffmpeg";
import { ytdlpFormat } from "@/@types/ytdlp";
import { store } from "../store";
import { authType } from "@/@types/setting";

const getAuthConfig = (): string[] => {
  const cookie = store.get("auth") as authType | undefined;
  if (!cookie) {
    return [];
  }
  if (cookie.type === "cookie") {
    return ["--cookies", cookie.path];
  }
  if (cookie.type === "browser") {
    if (cookie.profile.type === "chromiumProfile") {
      return [
        "--cookies-from-browser",
        `${cookie.profile.browser}:${cookie.profile.profileName}`,
      ];
    }
    if (cookie.profile.type === "firefoxBasicProfile") {
      return [
        "--cookies-from-browser",
        `firefox:"${cookie.profile.path
          .replace("\\", "\\\\")
          .replace('"', '\\"')}"`,
      ];
    }
    return [
      "--cookies-from-browser",
      `firefox:"${cookie.profile.path
        .replace("\\", "\\\\")
        .replace('"', '\\"')}"::"${cookie.profile.containerName}"`,
    ];
  }
  return [];
};

const getFormats = async (url: string): Promise<ytdlpFormat[]> => {
  const result = await spawn(ytdlpPath, [
    url,
    "--print",
    "formats_table",
    ...getAuthConfig(),
  ]);
  const parsed = result.stdout
    .replace(/^[\s\S]*\[info] Available formats for/g, "")
    .trimEnd()
    .split(/\r\n|\n|\r/g)
    .filter((val) => !val.match(/^(-+)$/))
    .map((value) => value.split(/[\s|]+/));
  const index = {
    id: parsed[0].indexOf("ID"),
    ext: parsed[0].indexOf("EXT"),
    resolution: parsed[0].indexOf("RESOLUTION"),
  };
  return parsed.slice(1).map((value) => {
    return {
      id: value[index.id],
      ext: value[index.ext],
      resolution: value[index.resolution],
    };
  });
};

const download = async (
  url: string,
  format: string,
  path: string,
  progress: (total: number, downloaded: number) => void
) => {
  let total = 0,
    downloaded = 0;
  const onData = (data: string) => {
    let match;
    if ((match = data.match(/^progress,([^,]*),([^,]*)/))) {
      const arr = data.split(",");
      downloaded = Number(arr[1]);
      total = Number(arr[2] === "NA" ? arr[3] : arr[2]);
    } else if ((match = data.match(/Duration: ([0-9:.]+),/))) {
      total = time2num(match[1]);
    } else if ((match = data.match(/time=([0-9:.]+) /))) {
      downloaded = time2num(match[1]);
    }
    progress(total, downloaded);
  };
  return await spawn(
    ytdlpPath,
    [
      url,
      "--format",
      format,
      "--output",
      path,
      "--progress-template",
      "progress,%(progress.downloaded_bytes)s,%(progress.total_bytes_estimate)s,%(progress.total_bytes)s",
      ...getAuthConfig(),
    ],
    undefined,
    onData,
    onData
  );
};

const time2num = (time: string) => {
  let second = 0;
  let offset = 0;
  while (time) {
    const index = time.lastIndexOf(":");
    second += Math.pow(60, offset++) * Number(time.slice(index + 1));
    time = index < 0 ? "" : time.slice(0, index);
  }
  return second;
};

export { getFormats, download };
