import { app, BrowserWindow, dialog, ipcMain, globalShortcut,Menu } from "electron";
import { Converter } from "./ffmpeg-stream/stream";
import * as path from "path";
import * as fs from "fs";
import * as Stream from "stream";
import { ffprobe as ffprobePath } from "./ffmpeg";
import {spawn} from "./lib/spawn";
import { typeGuard } from "./typeGuard";
import {execSync} from "child_process";


let mainWindow, renderWindow;
const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });
  mainWindow.removeMenu()

  const appURL = `file://${__dirname}/html/index.html`;

  mainWindow.loadURL(appURL);

  if (!app.isPackaged) {
    mainWindow.webContents.openDevTools();
  }
};

app.on("window-all-closed", () => {
  app.quit();
});
let conv: Converter;
let input: Stream.Writable;
let lastPromise = Promise.resolve() as Promise<unknown>;
let data,type;
app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
app.on("browser-window-focus", function () {
  globalShortcut.register("CommandOrControl+R", () => {
    console.log("CommandOrControl+R is pressed: Shortcut Disabled");
  });
  globalShortcut.register("F5", () => {
    console.log("F5 is pressed: Shortcut Disabled");
  });
});

app.on("browser-window-blur", function () {
  globalShortcut.unregister("CommandOrControl+R");
  globalShortcut.unregister("F5");
});

let i = 0,
  width,
  height,
  duration,
  targetFileName,
  generatedFrames = 0,
  fps,
  options;
const videoOption:{ss?:number,to?:number} = {};
ipcMain.on("request", async (IpcMainEvent, args) => {
  const value = args.data[0];
  if (typeGuard.render.buffer(value)) {

    for (const item of value.data) {
      let base64Image = item.split(";base64,").pop();
      lastPromise = lastPromise.then(() =>
        new Promise<unknown>((fulfill, reject) => {
          const myStream = new Stream.Readable();
          myStream._read = function (size) {
            const u8 = base64ToUint8Array(base64Image);
            myStream.push(u8);
            myStream.push(null);
          };
          i++;
          mainWindow.webContents.send("response", {
            type: "progress",
            target: "main",
            converted: i,
            generated: generatedFrames,
          });
          renderWindow.webContents.send("response", {
            type: "progress",
            target: "render",
            converted: i,
            generated: generatedFrames,
          });
          return myStream
            .on("end", fulfill) // fulfill promise on frame end
            .on("error", reject) // reject promise on error
            .pipe(input, { end: false }); // pipe to converter, but don't end the input yet
        }).catch((e) => {
          console.warn(e);
        })
      );
    }
  } else if (typeGuard.render.end(value)) {
    lastPromise.then(() => input.end());
  } else if (typeGuard.main.selectComment(value)) {
    await selectComment(IpcMainEvent);
  } else if (typeGuard.main.selectMovie(value)) {
    await selectMovie(IpcMainEvent);
  } else if (typeGuard.main.start(value)) {
    await convertStart(IpcMainEvent,value);
  } else if (typeGuard.render.progress(value)) {
    generatedFrames = value.data.generated;
  } else if (typeGuard.render.load(value)) {
    IpcMainEvent.reply("response", {
      type: "start",
      target: "render",
      data: data,
      format: type,
      options: options,
      duration: (videoOption.to || duration) - (videoOption.ss || 0),
      offset: (videoOption.ss || 0),
      fps: fps,
    });
  } else {
    mainWindow.webContents.send("response", {
      type: "message",
      target: "main",
      message: `unknown IPC Message: ${JSON.stringify(value)}`
    });
  }
});

function base64ToUint8Array(base64Str) {
  const raw = atob(base64Str);
  return Uint8Array.from(
    Array.prototype.map.call(raw, (x) => {
      return x.charCodeAt(0);
    })
  );
}
const convertStart = async(IpcMainEvent,value) => {
  const outputPath = await dialog.showSaveDialog({
    filters: [{ name: "mp4", extensions: ["mp4"] }],
    properties: ["createDirectory"],
  });
  if (outputPath.canceled) return;
  options = value.data;
  fps = value.fps;
  if (value.clipStart!==undefined){
    videoOption.ss = value.clipStart;
  }
  
  if (value.clipEnd!==undefined){
    videoOption.to = value.clipEnd;
  }
  
  IpcMainEvent.reply("response", {
    type: "start",
    target: "main",
    message: `path:${outputPath.filePath}`,
  });
  renderWindow = new BrowserWindow({
    width: 640,
    height: 360,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });
  renderWindow.removeMenu();
  renderWindow.loadURL(`file://${__dirname}/html/index.html?render`);
  
  if (!app.isPackaged) {
    renderWindow.webContents.openDevTools();
  }
  try {
    conv = new Converter();
    conv.createInputFromFile(targetFileName, videoOption);
    input = conv.createInputStream({
      f: "image2pipe",
      r: fps,
      filter_complex: `pad=width=max(iw\\,ih*(16/9)):height=ow/(16/9):x=(ow-iw)/2:y=(oh-ih)/2,scale=1920x1080,overlay=x=0:y=0`,
    });
    conv.output(outputPath.filePath, { vcodec: "libx264", "b:v": "0","cq":"25" }); // output to file
    await conv.run();
    renderWindow.webContents.send("response", {
      type: "end",
      target: "render",
    });
    mainWindow.webContents.send("response", {
      type: "end",
      target: "main",
    });
  }catch (e){
    mainWindow.webContents.send("response", {
      type: "message",
      target: "main",
      message: `unknown error: ${JSON.stringify(e)}`
    });
  }
}
const selectMovie = async(IpcMainEvent) => {
  const path = await dialog.showOpenDialog({
    properties: ["openFile"],
    filters: [
      {
        name: "Movies",
        extensions: ["mp4", "webm", "avi", "mkv", "wmv", "mov"],
      },
      {
        name: "All Files",
        extensions: ["*"],
      },
    ],
  });
  if (path.canceled) {
    return;
  }
  let ffprobe:spawnResult
  let metadata;
  try {
    ffprobe = await spawn(ffprobePath,[path.filePaths[0],"-hide_banner", "-v", "quiet", "-print_format", "json", "-show_streams"]);
  }catch (e) {
    IpcMainEvent.reply("response", {
      type: "selectMovie",
      target: "main",
      message: `
<div>input file is not movie(fail to execute ffprobe)</div>
<div>code:<pre><code>${e.code}</code></pre></div>
<div>stdout:<pre><code>${e.stdout}</code></pre></div>
<div>stdout:<pre><code>${e.stderr}</code></pre></div>`,
    });
    return;
  }
  try{
    metadata = JSON.parse(ffprobe.stdout);
  }catch (e){
    IpcMainEvent.reply("response", {
      type: "selectMovie",
      target: "main",
      message: `
<div>input file is not movie(fail to parse ffprobe output)</div>
<div>Error:<pre><code>${JSON.stringify(e)}</code></pre></div>`,
    });
    return;
  }
  if (!metadata.streams||!Array.isArray(metadata.streams)) {
    IpcMainEvent.reply("response", {
      type: "selectMovie",
      target: "main",
      message: "input file is not movie(stream not found)",
    });
    return;
  }
  for (const key in metadata.streams) {
    const stream = metadata.streams[key];
    if (stream.width) {
      width = stream.width;
    }
    if (stream.height) {
      height = stream.height;
    }
  }
  if (!(height && width)) {
    IpcMainEvent.reply("response", {
      type: "selectMovie",
      target: "main",
      message: "input file is not movie(fail to get resolution from input file)",
    });
    return;
  }
  duration = (await spawn(ffprobePath,[path.filePaths[0],"-hide_banner", "-v", "quiet", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1"])).stdout;
  targetFileName = path.filePaths;
  IpcMainEvent.reply("response", {
    type: "selectMovie",
    target: "main",
    data: { path,width, height, duration },
  });
}
const selectComment = async(IpcMainEvent) => {
  const path = await dialog.showOpenDialog({
    properties: ["openFile"],
    filters: [
      { name: "formatted/legacy/v1/owner JSON", extensions: ["json"] },
      { name: "niconicome XML", extensions: ["xml"] },
      { name: "legacyOwner TXT", extensions: ["txt"] },
      {
        name: "All Files",
        extensions: ["*"],
      },
    ],
  });
  if (path.canceled) return;
  const file = path.filePaths[0];
  const fileData = fs.readFileSync(file, "utf8");
  if (file.match(/\.xml$/)){
    data = fileData;
    type = "niconicome";
  }else if(file.match(/\.txt$/)){
    data = fileData;
    type = "legacyOwner";
  }else if(file.match(/\.json$/)){
    const json = JSON.parse(fileData);
    if (json?.meta?.status===200&&typeGuard.v1.threads(json?.data?.threads)){
      data = json.data.threads;
      type = "v1";
    }else{
      if(typeGuard.v1.threads(json)){
        type = "v1";
      }else if(typeGuard.legacy.rawApiResponses(json)){
        type = "legacy"
      }else if(typeGuard.owner.comments(json)){
        type = "owner"
      }else if(typeGuard.formatted.comments(json)||typeGuard.formatted.legacyComments(json)){
        type = "formatted"
      }else{
        return;
      }
      data = json;
    }
  }else{
    mainWindow.webContents.send("response", {
      type: "message",
      target: "main",
      message: `unknown input format`
    });
    return;
  }

  IpcMainEvent.reply("response", {
    type: "selectComment",
    target: "main",
    data: data,
    format: type,
  });
}