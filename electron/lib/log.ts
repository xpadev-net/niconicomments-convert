import * as fs from "node:fs";
import * as path from "node:path";
import log from "electron-log/main";

import { basePath } from "../context";

export const initLogger = (): void => {
  log.initialize();
  const logDir = path.join(basePath, "logs");
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir);
  }

  const d = new Date();
  const prefix =
    d.getFullYear() +
    `00${d.getMonth() + 1}`.slice(-2) +
    `00${d.getDate()}`.slice(-2);
  log.transports.file.level = "info";
  log.transports.file.resolvePathFn = () => path.join(logDir, `${prefix}.log`);
  process.on("uncaughtException", (err) => {
    log.error(err);
  });
};

type Logger = {
  debug: (...args: unknown[]) => void;
  log: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
  getLogger: (...prefix: string[]) => Logger;
};

export const getLogger = (...prefix: string[]): Logger => {
  return {
    debug: (...args: unknown[]) => log.debug(...prefix, ...args),
    log: (...args: unknown[]) => log.log(...prefix, ...args),
    info: (...args: unknown[]) => log.info(...prefix, ...args),
    warn: (...args: unknown[]) => log.warn(...prefix, ...args),
    error: (...args: unknown[]) => log.error(...prefix, ...args),
    getLogger: (..._prefix: string[]) => getLogger(...prefix, ..._prefix),
  };
};
