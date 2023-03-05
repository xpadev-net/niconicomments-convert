import * as path from "path";
import {
  chromiumBrowser,
  chromiumCookies,
  chromiumLocalState,
  chromiumProfile,
  columnInfo,
  Cookies,
} from "@/@types/cookies";
import * as fs from "fs";
import { typeGuard } from "../../typeGuard";
import { fetchAll, openClonedDB } from "../db";
import { spawn } from "../spawn";
import * as crypto from "crypto";
import { winProtect } from "@/@types/win-protect";

/*
reference source:
 - https://github.com/bertrandom/chrome-cookies-secure/blob/master/index.js
  Copyright (c) 2015 Yahoo! Inc.
  Released under the MIT License.
 - https://github.com/yt-dlp/yt-dlp/blob/master/yt_dlp/cookies.py
  Released under The Unlicense
 */

const salt = "saltysalt",
  integrations = 1003,
  keyLength = 16;

const getChromiumRootDir = (browser: chromiumBrowser) => {
  if (process.platform === "win32") {
    if (!process.env.APPDATA) throw new Error("fail to resolve appdata");
    if (!process.env.LOCALAPPDATA)
      throw new Error("fail to resolve local appdata");
    if (browser === "brave") {
      return path.join(
        process.env.LOCALAPPDATA,
        "BraveSoftware/Brave-Browser/User Data"
      );
    }
    if (browser === "chrome") {
      return path.join(process.env.LOCALAPPDATA, "Google/Chrome/User Data");
    }
    if (browser === "chromium") {
      return path.join(process.env.LOCALAPPDATA, "Chromium/User Data");
    }
    if (browser === "edge") {
      return path.join(process.env.LOCALAPPDATA, "Microsoft/Edge/User Data");
    }
    if (browser === "opera") {
      return path.join(process.env.APPDATA, "Opera Software/Opera Stable");
    }
    if (browser === "vivaldi") {
      return path.join(process.env.LOCALAPPDATA, "Vivaldi/User Data");
    }
    throw new Error("unknown browser");
  }
  if (!process.env.HOME) throw new Error("fail to resolve home dir");
  if (browser === "brave") {
    return path.join(
      process.env.HOME,
      "Library/Application Support/BraveSoftware/Brave-Browser"
    );
  }
  if (browser === "chrome") {
    return path.join(
      process.env.HOME,
      "Library/Application Support/Google/Chrome"
    );
  }
  if (browser === "chromium") {
    return path.join(process.env.HOME, "Library/Application Support/Chromium");
  }
  if (browser === "edge") {
    return path.join(
      process.env.HOME,
      "Library/Application Support/Microsoft Edge"
    );
  }
  if (browser === "opera") {
    return path.join(
      process.env.HOME,
      "Library/Application Support/com.operasoftware.Opera"
    );
  }
  if (browser === "vivaldi") {
    return path.join(process.env.HOME, "Library/Application Support/Vivaldi");
  }
  throw new Error("unknown browser");
};

const getChromiumKeyName = (browser: chromiumBrowser) => {
  if (browser === "brave") {
    return "Brave";
  }
  if (browser === "chrome") {
    return "Chrome";
  }
  if (browser === "chromium") {
    return "Chromium";
  }
  if (process.platform === "darwin") {
    if (browser === "edge") {
      return "Microsoft Edge";
    }
    if (browser === "opera") {
      return "Opera";
    }
    if (browser === "vivaldi") {
      return "Vivaldi";
    }
  }
  if (browser === "vivaldi") {
    return "Chrome";
  }
  return "Chromium";
};

const getAvailableChromiumProfiles = (browser: chromiumBrowser) => {
  const root = getChromiumRootDir(browser);
  const metadata = JSON.parse(
    fs.readFileSync(path.join(root, "Local State"), "utf-8")
  ) as unknown;
  if (!typeGuard.chromium.profiles(metadata))
    throw new Error("invalid manifest file");
  const result: chromiumProfile[] = [];
  for (const key of Object.keys(metadata.profile.info_cache)) {
    const value = metadata.profile.info_cache[key];
    const profilePath = path.join(root, key);
    if (!fs.existsSync(profilePath)) continue;
    result.push({
      type: "chromiumProfile",
      browser: browser,
      name: value.name,
      path: profilePath,
    });
  }
  return result;
};

const getChromiumCookies = async (profile: chromiumProfile) => {
  const cookiesPath = (() => {
    const basePath = path.join(profile.path, "Cookies");
    if (fs.existsSync(basePath)) {
      return basePath;
    }
    return path.join(profile.path, "Network", "Cookies");
  })();
  const db = openClonedDB(cookiesPath);
  const columns = (await fetchAll(
    db,
    "PRAGMA table_info(`cookies`)"
  )) as columnInfo;
  const secureColumn = columns.reduce(
    (pv, val) => val.name === "is_secure" || pv,
    false
  )
    ? "is_secure"
    : "secure";
  const rows = (await fetchAll(
    db,
    `SELECT host_key, name, value, encrypted_value, path, expires_utc, ${secureColumn} FROM cookies`
  )) as chromiumCookies[];
  const decryptor = await (process.platform === "win32"
    ? getWindowsDecryptor
    : getMacDecryptor)(profile);
  const cookies: Cookies = {};
  for (const row of rows) {
    if (row.host_key.match(/\.nicovideo\.jp/)) {
      cookies[row.name] = decryptor(row.encrypted_value);
    }
  }
  console.log(cookies);
  return cookies;
};

const pbkdf2 = (input: string): Promise<Buffer> => {
  return new Promise((resolve, reject) => {
    crypto.pbkdf2(
      input,
      salt,
      integrations,
      keyLength,
      "sha1",
      (err, derivedKey) => {
        if (err) {
          reject(err);
        } else {
          resolve(derivedKey);
        }
      }
    );
  });
};

const decryptAES256GCM = (
  key: Buffer,
  enc: Buffer,
  nonce: Buffer,
  tag: Buffer
) => {
  const algorithm = "aes-256-gcm";
  const decipher = crypto.createDecipheriv(algorithm, key, nonce);
  decipher.setAuthTag(tag);
  let str = decipher.update(enc, undefined, "utf8");
  str += decipher.final("utf-8");
  return str;
};

const getWindowsDecryptor = async (
  profile: chromiumProfile
): Promise<(value: Buffer) => string> => {
  const localState = JSON.parse(
    fs.readFileSync(path.join(profile.path, "../", "Local State"), "utf-8")
  ) as chromiumLocalState;
  const base64_key = localState.os_crypt.encrypted_key;
  const encryptedKey = Buffer.from(base64_key, "base64");
  const wp = (await import("win-protect")) as winProtect;
  return (value: Buffer) => {
    if (value[0] == 0x76 && value[1] == 0x31 && value[2] == 0x30) {
      const key: Buffer = wp.decrypt(
        encryptedKey.slice(5, encryptedKey.length)
      );
      const nonce: Buffer = value.slice(3, 15);
      const tag: Buffer = value.slice(value.length - 16, value.length);
      value = value.slice(15, value.length - 16);
      return decryptAES256GCM(key, value, nonce, tag);
    }
    if (
      value[0] == 0x01 &&
      value[1] == 0x00 &&
      value[2] == 0x00 &&
      value[3] == 0x00
    ) {
      return wp.decrypt(value).toString();
    }
  };
};

const getMacDecryptor = async (
  profile: chromiumProfile
): Promise<(value: Buffer) => string> => {
  const keyName = getChromiumKeyName(profile.browser);
  const keyResult = await spawn("security", [
    "find-generic-password",
    "-w",
    "-a",
    keyName,
    "-s",
    `${keyName} Safe Storage`,
  ]);
  if (keyResult.code) throw new Error("failed to get chromium key");
  const key = await pbkdf2(keyResult.stdout.trim());
  return (value: Buffer) => {
    const iv = Buffer.from(" ".repeat(keyLength), "binary");
    const decipher = crypto.createDecipheriv("aes-128-cbc", key, iv);
    decipher.setAutoPadding(false);
    const encryptedData = value.slice(3);
    let decoded = decipher.update(encryptedData);
    const final = decipher.final();
    final.copy(decoded, decoded.length - 1);
    const padding = decoded[decoded.length - 1];
    if (padding) {
      decoded = decoded.slice(0, decoded.length - padding);
    }
    return decoded.toString("utf8");
  };
};

export { getAvailableChromiumProfiles, getChromiumCookies };