// Snap only arithmetic roundoff at integer boundaries before rounding up.
const ceilWithRoundoff = (value: number, scale: number): number => {
  const nearest = Math.round(value);
  const tolerance = 4 * Number.EPSILON * Math.max(1, Math.abs(scale));
  return Math.abs(value - nearest) <= tolerance ? nearest : Math.ceil(value);
};

const getFrameCount = (start: number, end: number, fps: number): number =>
  ceilWithRoundoff(
    (end - start) * fps,
    Math.max(Math.abs(start), Math.abs(end)) * fps,
  );

const getFrameVpos = (frame: number, start: number, fps: number): number => {
  const vpos = start * 100 + (frame * 100) / fps;
  return ceilWithRoundoff(vpos, vpos);
};

export { getFrameCount, getFrameVpos };
