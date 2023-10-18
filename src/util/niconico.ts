import type { NicoId } from "@/@types/brand";

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

export { getNicoId, isNicovideoUrl };
