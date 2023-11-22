import type { NicoId } from "@/@types/brand";
import type {
  V3MetadataAudioItem,
  V3MetadataDMSAudioItem,
  V3MetadataDMSVideoItem,
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

function getDMCBestSegment<T extends V3MetadataAudioItem | V3MetadataVideoItem>(
  input: T[],
): T {
  let bestItem = input[0];
  for (const item of input) {
    if (!item.isAvailable) continue;
    if (bestItem.metadata.bitrate < item.metadata.bitrate) {
      bestItem = item;
    }
  }
  return bestItem;
}

const getDMSBestSegment = <
  T extends V3MetadataDMSAudioItem | V3MetadataDMSVideoItem,
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

export { getDMCBestSegment, getDMSBestSegment, getNicoId, isNicovideoUrl };
