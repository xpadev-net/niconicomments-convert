import type { TRemoteMovieItemFormat } from "@/@types/queue";
import type { SpawnResult } from "@/@types/spawn";

import { sendMessageToController } from "../../controllerWindow";
import { downloadDelivery } from "./delivery";
import { downloadDomand } from "./domand";
import { getMetadata } from "./utils";

const download = async (
  nicoId: string,
  format: TRemoteMovieItemFormat,
  path: string,
  progress: (total: number, downloaded: number) => void,
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
  if (format.type === "delivery") {
    return await downloadDelivery(nicoId, metadata, format, path, progress);
  }
  if (format.type === "domand") {
    return await downloadDomand(nicoId, metadata, format, path, progress);
  }
};

export { download };
