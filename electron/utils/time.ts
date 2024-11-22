const time2num = (_time: string): number => {
  let second = 0;
  let offset = 0;
  let time = _time;
  while (time) {
    const index = time.lastIndexOf(":");
    second += 60 ** offset++ * Number(time.slice(index + 1));
    time = index < 0 ? "" : time.slice(0, index);
  }
  return second;
};

export { time2num };
