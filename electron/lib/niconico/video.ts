import type { TRemoteMovieItemFormat } from "@/@types/queue";
import type { SpawnResult } from "@/@types/spawn";

import { downloadDMC } from "./dmc";
import { downloadDMS } from "./dms";
import { getMetadata } from "./utils";

const download = async (
  nicoId: string,
  format: TRemoteMovieItemFormat,
  path: string,
  progress: (total: number, downloaded: number, eta: number) => void,
  signal: AbortSignal,
): Promise<SpawnResult> => {
  const metadata = await getMetadata(nicoId, signal);
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
