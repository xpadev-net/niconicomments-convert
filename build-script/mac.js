import builder from "electron-builder";

await builder.build({
  config: {
    appId: "net.xpadev.niconicomments-convert",
    icon: "assets/niconicomments_icon.png",
    mac: {
      target: {
        target: "dmg",
        arch: ["x64"],
      },
      singleArchFiles: "*",
    },
  },
  publish: "never",
});
