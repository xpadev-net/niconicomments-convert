import log from "electron-log/renderer";

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
