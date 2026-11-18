const builder = require("electron-builder");

process.env.CSC_IDENTITY_AUTO_DISCOVERY = "false";

builder.build({
  config: {
    appId: "net.xpadev.niconicomments-convert",
    icon: "assets/niconicomments_icon.png",
    win: {
      // electron-updater on Windows requires the NSIS target; zip stays for
      // portable distribution.
      target: [
        { target: "zip", arch: ["x64"] },
        { target: "nsis", arch: ["x64"] },
      ],
      signAndEditExecutable: false,
    },
    publish: {
      provider: "github",
      owner: "xpadev-net",
      repo: "niconicomments-convert",
    },
  },
  publish: "never",
});
