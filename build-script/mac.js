import builder from "electron-builder";

builder.build({
  config: {
    appId: "net.xpadev.niconicomments-convert",
    icon: "assets/niconicomments_icon.png",
    mac: {
      target: {
        target: "dmg",
        arch: ["x64"],
      },
      singleArchFiles: "*",
      hardenedRuntime: true,
      gatekeeperAssess: false,
      notarize: true,
    },
  },
  publish: "never",
});
