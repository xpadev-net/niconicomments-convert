import builder from "electron-builder";

builder.build({
  config: {
    appId: "net.xpadev.niconicomments-convert",
    icon: "assets/niconicomments_icon.png",
    mac: {
      // electron-updater on macOS requires the zip target next to the dmg.
      target: [
        { target: "dmg", arch: ["arm64"] },
        { target: "zip", arch: ["arm64"] },
      ],
      singleArchFiles: "*",
      hardenedRuntime: true,
      gatekeeperAssess: false,
      notarize: true,
    },
    publish: {
      provider: "github",
      owner: "xpadev-net",
      repo: "niconicomments-convert",
    },
  },
  publish: "never",
});
