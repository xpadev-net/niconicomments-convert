const time2num = (time: string): number => {
  let second = 0;
  let offset = 0;
  while (time) {
    const index = time.lastIndexOf(":");
    second += Math.pow(60, offset++) * Number(time.slice(index + 1));
    time = index < 0 ? "" : time.slice(0, index);
  }
  return second;
};

export { time2num };
