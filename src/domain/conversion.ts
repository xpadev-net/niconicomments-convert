import { isPositiveFinite, isRecord } from "./validation";

// Shared by the form and queue admission so FFmpeg and the renderer receive
// the same validated values. An omitted clip boundary means 0 / movie duration.
const getConversionError = (
  option: unknown,
  duration: unknown,
): string | undefined => {
  if (!isRecord(option)) return "変換設定が不正です。";
  if (!isPositiveFinite(option.fps))
    return "FPSは0より大きい有限の数値を指定してください。";
  if (
    !isPositiveFinite(option.width) ||
    !Number.isSafeInteger(option.width) ||
    !isPositiveFinite(option.height) ||
    !Number.isSafeInteger(option.height)
  )
    return "解像度は正の整数を指定してください。";
  if (!isPositiveFinite(duration)) return "動画の長さが不正です。";
  const start = option.ss === undefined ? 0 : option.ss;
  const end = option.to === undefined ? duration : option.to;
  if (
    typeof start !== "number" ||
    !Number.isFinite(start) ||
    start < 0 ||
    start >= duration
  )
    return "開始位置は0以上、動画の長さ未満で指定してください。";
  if (!isPositiveFinite(end) || end > duration || end <= start)
    return "終了位置は開始位置より後、動画の長さ以下で指定してください。";
  if (!isRecord(option.options)) return "コメント描画設定が不正です。";
  const nico = option.options;
  if (nico.scale !== undefined && !isPositiveFinite(nico.scale))
    return "スケールは0より大きい有限の数値を指定してください。";
  if (
    nico.mode !== undefined &&
    (typeof nico.mode !== "string" ||
      !["default", "html5", "flash"].includes(nico.mode))
  )
    return "変換モードが不正です。";
  for (const key of ["showCollision", "showCommentCount", "keepCA"]) {
    if (nico[key] !== undefined && typeof nico[key] !== "boolean")
      return "コメント描画設定が不正です。";
  }
  if (!Number.isFinite(option.fps * (end - start)))
    return "変換するフレーム数が大きすぎます。";
  return undefined;
};

export { getConversionError };
