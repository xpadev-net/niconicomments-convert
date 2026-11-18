import * as fs from "node:fs";
import * as path from "node:path";
import { app } from "electron";
import log from "electron-log/main.js";

export const initLogger = (): void => {
  log.initialize();
  const d = new Date();
  const prefix =
    d.getFullYear() +
    `00${d.getMonth() + 1}`.slice(-2) +
    `00${d.getDate()}`.slice(-2);
  try {
    const logDir = app.getPath("logs");
    fs.mkdirSync(logDir, { recursive: true });
    log.transports.file.resolvePathFn = () =>
      path.join(logDir, `${prefix}.log`);
    log.transports.file.level = "info";
  } catch (error) {
    // Keep startup and its error dialog usable even if the log directory fails.
    log.transports.file.level = false;
    log.warn("Failed to initialize file logging:", error);
  }
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
