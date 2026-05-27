const builder = require("electron-builder");

process.env.CSC_IDENTITY_AUTO_DISCOVERY = "false";

builder.build({
  config: {
    appId: "net.xpadev.niconicomments-convert",
    icon: "assets/niconicomments_icon.png",
    win: {
      target: {
        target: "zip",
        arch: [
          "x64",
          //'ia32',
        ],
      },
      signAndEditExecutable: false,
    },
  },
  publish: "never",
});
