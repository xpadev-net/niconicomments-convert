const isNicovideoUrl = (url: string) => {
  return !!url.match(
    /^(?:https?:\/\/)?(?:nico\.ms|(?:www\.)?nicovideo\.jp\/watch)\/((?:sm|nm|so)?[1-9][0-9]*)(?:.*)?$/
  );
};

export { isNicovideoUrl };
