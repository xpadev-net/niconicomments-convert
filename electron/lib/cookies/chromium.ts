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
  const db = openClonedDB(path.join(profile.path, "Cookies"));
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
  return cookies;
};

const pbkdf2 = (input: string) => {
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

const decryptAES256GCM = (key, enc, nonce, tag) => {
  const algorithm = "aes-256-gcm";
  const decipher = crypto.createDecipheriv(algorithm, key, nonce);
  decipher.setAuthTag(tag);
  let str = decipher.update(enc, "base64", "utf8");
  str += decipher.final("utf-8");
  return str;
};

const getWindowsDecryptor = async (profile: chromiumProfile) => {
  const localState = JSON.parse(
    fs.readFileSync(path.join(profile.path, "Local State"), "utf-8")
  ) as chromiumLocalState;
  const base64_key = localState.os_crypt.encrypted_key;
  if (!base64_key.startsWith("DPAPI")) {
    throw new Error("invalid key");
  }
  const encryptedKey = Buffer.from(base64_key, "base64");
  const dpapi = require("win-dpapi");
  return (value: Buffer) => {
    if (
      value[0] == 0x01 &&
      value[1] == 0x00 &&
      value[2] == 0x00 &&
      value[3] == 0x00
    ) {
      return dpapi.unprotectData(value, null, "CurrentUser").toString("utf-8");
    } else if (value[0] == 0x76 && value[1] == 0x31 && value[2] == 0x30) {
      const key = dpapi.unprotectData(
        encryptedKey.slice(5, encryptedKey.length),
        null,
        "CurrentUser"
      );
      const nonce = value.slice(3, 15);
      const tag = value.slice(value.length - 16, value.length);
      value = value.slice(15, value.length - 16);
      return decryptAES256GCM(key, value, nonce, tag);
    }
  };
};

const getMacDecryptor = async (profile: chromiumProfile) => {
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
    // @ts-ignore
    const decipher = crypto.createDecipheriv("aes-128-cbc", key, iv);
    decipher.setAutoPadding(false);
    const encryptedData = value.slice(3);
    let decoded = decipher.update(encryptedData);
    const final = decipher.final();
    final.copy(decoded, decoded.length - 1);
    let padding = decoded[decoded.length - 1];
    if (padding) {
      decoded = decoded.slice(0, decoded.length - padding);
    }
    return decoded.toString("utf8");
  };
};

export { getAvailableChromiumProfiles, getChromiumCookies };
