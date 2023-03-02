import * as fs from "fs";
import { safariProfile } from "@/@types/cookies";

const getAvailableSafariProfiles = (): safariProfile[] => {
  if (process.platform !== "darwin") return [];
  if (fs.existsSync("~/Library/Cookies/Cookies.binarycookies")) {
    return [
      {
        type: "safari",
        path: "~/Library/Cookies/Cookies.binarycookies",
      },
    ];
  }
  if (
    fs.existsSync(
      "~/Library/Containers/com.apple.Safari/Data/Library/Cookies/Cookies.binarycookies"
    )
  ) {
    return [
      {
        type: "safari",
        path: "~/Library/Containers/com.apple.Safari/Data/Library/Cookies/Cookies.binarycookies",
      },
    ];
  }
  return [];
};

const getSafariCookies = (profile: safariProfile) => {
  const buffer = fs.readFileSync(profile.path);
  bufferExpect(buffer, "cook");
};

const bufferExpect = (buffer: Buffer, target: string) => {
  const targetBuffer = Buffer.from(target);
  if (!Buffer.compare(buffer.subarray(0, targetBuffer.length), targetBuffer)) {
    throw new Error("invalid database signature");
  }
};

export { getSafariCookies, getAvailableSafariProfiles };
