import type { TRemoteMovieItemFormat } from "@/@types/queue";
import type { SpawnResult } from "@/@types/spawn";

import { sendMessageToController } from "../../controller-window";
import { downloadDMC } from "./dmc";
import { downloadDMS } from "./dms";
import { getMetadata } from "./utils";

const download = async (
  nicoId: string,
  format: TRemoteMovieItemFormat,
  path: string,
  progress: (total: number, downloaded: number, eta: number) => void,
): Promise<SpawnResult | undefined> => {
  const metadata = await getMetadata(nicoId);
  if (!metadata) {
    sendMessageToController({
      type: "message",
      title: "動画情報の取得に失敗しました",
      message:
        "動画が削除などされていないか確認してください\nniconico / download / failed to get metadata",
    });
    return;
  }
  if (format.type === "dmc") {
    return await downloadDMC(metadata, format, path, progress);
  }
  if (format.type === "dms") {
    return await downloadDMS(metadata, format, path, progress);
  }
};

export { download };
