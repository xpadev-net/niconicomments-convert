import {app, BrowserWindow, dialog,ipcMain,globalShortcut} from "electron";
import {Converter} from "./ffmpeg-stream/stream";
import * as path from "path";
import * as fs from "fs";
import * as Stream from "stream";
import {ffprobe as ffprobePath} from "./ffmpeg";
import {execSync} from "child_process";

const createWindow = () => {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  const appURL = `file://${__dirname}/html/index.html`;

  win.loadURL(appURL);

  if (!app.isPackaged) {
    win.webContents.openDevTools();
  }
};

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
let conv: Converter;
let input: Stream.Writable;
let lastPromise = Promise.resolve() as Promise<unknown>;
app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });

});
app.on('browser-window-focus', function () {
  globalShortcut.register("CommandOrControl+R", () => {
    console.log("CommandOrControl+R is pressed: Shortcut Disabled");
  });
  globalShortcut.register("F5", () => {
    console.log("F5 is pressed: Shortcut Disabled");
  });
});

app.on('browser-window-blur', function () {
  globalShortcut.unregister('CommandOrControl+R');
  globalShortcut.unregister('F5');
});

let i = 0,width, height, duration, targetFileName;
ipcMain.on("request", async (IpcMainEvent, args) => {
  if (args.data[0].type === "buffer") {
    for (const item of args.data[0].data) {
      let base64Image = item.split(';base64,').pop();
      lastPromise = lastPromise.then(() => new Promise<unknown>((fulfill, reject) => {
          const myStream = new Stream.Readable();
          myStream._read = function (size) {
            const u8 = base64ToUint8Array(base64Image)
            myStream.push(u8);
            myStream.push(null);
          };
          i++;
          IpcMainEvent.reply("response",{type:"progress",current:i});
          return myStream
            .on('end', fulfill) // fulfill promise on frame end
            .on('error', reject) // reject promise on error
            .pipe(input, {end: false}) // pipe to converter, but don't end the input yet
        }
      ).catch((e) => {
        console.warn(e)
      }));
    }
  } else if (args.data[0].type === "end") {
    lastPromise.then(() => input.end());
  } else if (args.data[0].type === "selectComment") {
    const path = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{name: "JSON", extensions: ["json"]}]
    });
    if (path.canceled)return;
    const json = JSON.parse(fs.readFileSync(path.filePaths[0], 'utf8'));

    IpcMainEvent.reply("response",{type:"selectComment",data:json});
  } else if (args.data[0].type === "selectMovie") {
    const path = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{name: "Movies", extensions: ["mp4", "webm", "avi", "mkv", "wmv", "mov"]}, {
        name: "All Files",
        extensions: ["*"]
      }]
    });
    if (path.canceled) {
      IpcMainEvent.reply("response",{type:"selectMovie",message:"cancelled"});
      return;
    }
    const ffprobe = execSync(`${ffprobePath} ${path.filePaths[0]} -hide_banner -v quiet -print_format json -show_streams`);
    let metadata;
    metadata = JSON.parse(ffprobe.toString());
    if (!metadata.streams) {
      IpcMainEvent.reply("response",{type:"selectMovie",message:"input file is not movie"});
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
      IpcMainEvent.reply("response",{type:"selectMovie",message:"fail to get resolution from input file"});
      return;
    }
    duration = execSync(`${ffprobePath} ${path.filePaths[0]} -v quiet -show_entries format=duration -of default=noprint_wrappers=1:nokey=1`).toString();
    targetFileName = path.filePaths;
    IpcMainEvent.reply("response",{type:"selectMovie",message:`path:${path.filePaths}, width:${width}, height:${height}, duration:${duration}`,data:{width,height,duration}});
  } else if(args.data[0].type === "start"){
    const path = await dialog.showSaveDialog( {
      filters: [
        { name: 'mp4', extensions: ['mp4'] },
      ],
      properties:[
        'createDirectory',
      ]
    });
    if( path.canceled )return;

    IpcMainEvent.reply("response",{type:"start",message:`path:${path.filePath}`});
    conv = new Converter() // create converter
    conv.createInputFromFile(targetFileName, {});
    input = conv.createInputStream({
      f: 'image2pipe',
      r: 30,
      filter_complex: `[1:v]scale=${width}:${height} [ovrl],[0:v][ovrl]overlay=(main_w-overlay_w)/2:(main_h-overlay_h)/2`
    }) // create input writable stream
    conv.output(path.filePath, {vcodec: 'libx264', pix_fmt: 'yuv420p'}) // output to file

    conv.run()
  }else{
    console.log(args);
  }
});

function base64ToUint8Array(base64Str) {
  const raw = atob(base64Str);
  return Uint8Array.from(Array.prototype.map.call(raw, (x) => {
    return x.charCodeAt(0);
  }));
}