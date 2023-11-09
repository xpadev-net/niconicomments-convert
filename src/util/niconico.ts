import type { NicoId } from "@/@types/brand";
import type {
  V3MetadataAudioItem,
  V3MetadataDomandAudioItem,
  V3MetadataDomandVideoItem,
  V3MetadataVideoItem,
} from "@/@types/niconico";

const isNicovideoUrl = (url: string): boolean => {
  return !!url.match(
    /^(?:https?:\/\/)?(?:nico\.ms|(?:www\.)?nicovideo\.jp\/watch)\/((?:sm|nm|so)?[1-9][0-9]*)(?:.*)?$/,
  );
};
const getNicoId = (url: string): NicoId | undefined => {
  const match = url.match(
    /^(?:https?:\/\/)?(?:nico\.ms|(?:www\.)?nicovideo\.jp\/watch)\/((?:sm|nm|so)?[1-9][0-9]*)(?:.*)?$/,
  );
  if (!match || !match[1]) return undefined;
  return match[1] as NicoId;
};

function getDeliveryBestSegment<
  T extends V3MetadataAudioItem | V3MetadataVideoItem,
>(input: T[]): T {
  let bestItem = input[0];
  for (const item of input) {
    if (!item.isAvailable) continue;
    if (bestItem.metadata.bitrate < item.metadata.bitrate) {
      bestItem = item;
    }
  }
  return bestItem;
}

const getDomandBestSegment = <
  T extends V3MetadataDomandAudioItem | V3MetadataDomandVideoItem,
>(
  input: T[],
): T => {
  let bestItem = input[0];
  for (const item of input) {
    if (!item.isAvailable) continue;
    if (bestItem.bitRate < item.bitRate) {
      bestItem = item;
    }
  }
  return bestItem;
};

export {
  getDeliveryBestSegment,
  getDomandBestSegment,
  getNicoId,
  isNicovideoUrl,
};
