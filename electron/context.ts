let inputPath: string = "";
const setInputPath = (val: string) => (inputPath = val);
let generatedFrames: number = 0;
const setGeneratedFrames = (val: number) => (generatedFrames = val);
let commendData: { type: inputFormatTypes; data: inputFormats };
const setCommentData = (val: { type: inputFormatTypes; data: inputFormats }) =>
  (commendData = val);
let videoOption;
const setVideoOptions = (val) => (videoOption = val);
let duration;
const setDuration = (val) => (duration = val);
let niconicommentsOption;
const setNiconicommentsOption = (val) => (niconicommentsOption = val);
export {
  inputPath,
  setInputPath,
  generatedFrames,
  setGeneratedFrames,
  commendData,
  setCommentData,
  videoOption,
  setVideoOptions,
  duration,
  setDuration,
  niconicommentsOption,
  setNiconicommentsOption,
};
