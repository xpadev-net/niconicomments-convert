import {ffmpegPath,ffprobePath} from "ffmpeg-ffprobe-static";

const ffmpeg = (ffmpegPath as string).replace('app.asar','app.asar.unpacked'),
  ffprobe = (ffprobePath as string).replace('app.asar','app.asar.unpacked');


export {
  ffmpeg,
  ffprobe
}