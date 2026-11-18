import type { TRemoteMovieItemFormat } from "@/@types/queue.js";
import type { SpawnResult } from "@/@types/spawn.js";

import { downloadDMC } from "./dmc.js";
import { downloadDMS } from "./dms.js";
import { withRequestTimeout } from "./request.js";
import { getMetadata } from "./utils.js";

const download = async (
  nicoId: string,
  format: TRemoteMovieItemFormat,
  path: string,
  progress: (total: number, downloaded: number, eta: number) => void,
  signal: AbortSignal,
): Promise<SpawnResult> => {
  const metadata = await withRequestTimeout(signal, (requestSignal) =>
    getMetadata(nicoId, requestSignal),
  );
  signal.throwIfAborted();
  if (!metadata) {
    throw new Error(
      "動画情報の取得に失敗しました。動画が削除などされていないか確認してください",
    );
  }
  if (format.type === "dmc") {
    return await downloadDMC(metadata, format, path, progress, signal);
  }
  return await downloadDMS(metadata, format, path, progress, signal);
};

export { download };
