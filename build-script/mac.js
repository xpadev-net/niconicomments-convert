const builder = require("electron-builder");

builder.build({
  config: {
    appId: "net.xpadev.niconicomments-convert",
    icon: "assets/niconicomments_icon.png",
    mac: {
      // electron-updater on macOS requires the zip target next to the dmg.
      target: [
        { target: "dmg", arch: ["x64"] },
        { target: "zip", arch: ["x64"] },
      ],
      singleArchFiles: "*",
    },
    publish: {
      provider: "github",
      owner: "xpadev-net",
      repo: "niconicomments-convert",
    },
  },
  publish: "never",
});
