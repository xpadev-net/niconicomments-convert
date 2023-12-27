/*
ffmpeg-stream
(c) phaux Nikita
Released under the MIT License.
source file: https://github.com/phaux/node-ffmpeg-stream/blob/master/src/index.ts
 */
import type { ChildProcess } from "child_process";
import { spawn } from "child_process";
import { createReadStream, createWriteStream, unlink } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import type { Readable, Writable } from "stream";
import { PassThrough } from "stream";
import { promisify } from "util";

import { ffmpegPath } from "../assets";
import { sendMessageToController } from "../controller-window";
import { encodeJson } from "../lib/json";
import { getLogger } from "../lib/log";

const logger = getLogger("[ffmpeg-stream]");

const { FFMPEG_PATH = ffmpegPath } = process.env;
const EXIT_CODES = [0, 255];

function debugStream(stream: Readable | Writable, name: string): void {
  stream.on("error", (err) => {
    logger.debug(`${name} error: ${err.message}`);
  });
  stream.on("data", (data: string | Buffer) => {
    logger.debug(`${name} data: ${data.length} bytes`);
  });
  stream.on("finish", () => {
    logger.debug(`${name} finish`);
  });
}

function getTmpPath(prefix = "", suffix = ""): string {
  const dir = tmpdir();
  const id = Math.random().toString(32).substring(2, 12);
  return join(dir, `${prefix}${id}${suffix}`);
}

export type Options = Record<
  string,
  | string
  | number
  | boolean
  | Array<string | null | undefined>
  | null
  | undefined
>;

function getArgs(options: Options): string[] {
  const args: string[] = [];
  for (const option in options) {
    const value = options[option];
    if (Array.isArray(value)) {
      for (const element of value) {
        if (element != null) {
          args.push(`-${option}`);
          args.push(String(element));
        }
      }
    } else if (value != null && value !== false) {
      args.push(`-${option}`);
      if (typeof value != "boolean") {
        args.push(String(value));
      }
    }
  }
  return args;
}

interface Pipe {
  readonly type: "input" | "output";
  readonly options: Options;
  readonly file: string;
  onBegin?: (this: void) => Promise<void>;
  onSpawn?: (this: void, process: ChildProcess) => void;
  onFinish?: (this: void) => Promise<void>;
}

/** @deprecated Construct [[Converter]] class directly */
export function ffmpeg(): Converter {
  return new Converter();
}

export class Converter {
  private fdCount = 0;
  private readonly pipes: Pipe[] = [];
  private process?: ChildProcess;
  private killed = false;

  /** @deprecated Use [[createInputStream]] or [[createInputFromFile]] */
  input(options?: Options): Writable;
  input(file: string, options?: Options): void;
  input(arg0?: string | Options, arg1?: Options): Writable | undefined {
    const [file, opts = {}] =
      typeof arg0 == "string" ? [arg0, arg1] : [undefined, arg0];

    if (file != null) {
      this.createInputFromFile(file, opts);
      return;
    }
    if (opts.buffer) {
      delete opts.buffer;
      return this.createBufferedInputStream(opts);
    }
    return this.createInputStream(opts);
  }

  /** @deprecated Use [[createOutputStream]] or [[createOutputToFile]] */
  output(options?: Options): Readable;
  output(file: string, options?: Options): void;
  output(arg0?: string | Options, arg1?: Options): Readable | undefined {
    const [file, opts = {}] =
      typeof arg0 == "string" ? [arg0, arg1] : [undefined, arg0];

    if (file != null) {
      this.createOutputToFile(file, opts);
      return;
    }
    if (opts.buffer) {
      delete opts.buffer;
      return this.createBufferedOutputStream(opts);
    }
    return this.createOutputStream(opts);
  }

  createInputFromFile(file: string, options: Options): void {
    this.pipes.push({
      type: "input",
      options,
      file,
    });
  }

  createOutputToFile(file: string, options: Options): void {
    this.pipes.push({
      type: "output",
      options,
      file,
    });
  }

  createInputStream(options: Options): Writable {
    const stream = new PassThrough();
    const fd = this.getUniqueFd();
    this.pipes.push({
      type: "input",
      options,
      file: `pipe:${fd}`,
      onSpawn: (process) => {
        const stdio = process.stdio[fd];
        if (stdio == null) throw Error(`input ${fd} is null`);
        debugStream(stream, `input ${fd}`);
        if (!("write" in stdio)) throw Error(`input ${fd} is not writable`);
        stream.pipe(stdio);
      },
    });

    return stream;
  }

  createOutputStream(options: Options): Readable {
    const stream = new PassThrough();
    const fd = this.getUniqueFd();
    this.pipes.push({
      type: "output",
      options,
      file: `pipe:${fd}`,
      onSpawn: (process) => {
        const stdio = process.stdio[fd];
        if (stdio == null) throw Error(`output ${fd} is null`);
        debugStream(stdio, `output ${fd}`);
        stdio.pipe(stream);
      },
    });
    return stream;
  }

  createBufferedInputStream(options: Options): Writable {
    const stream = new PassThrough();
    const file = getTmpPath("ffmpeg-");
    this.pipes.push({
      type: "input",
      options,
      file,
      onBegin: async () => {
        await new Promise<void>((resolve, reject): void => {
          const writer = createWriteStream(file);
          stream.pipe(writer);
          stream.on("end", () => {
            logger.debug("input buffered stream end");
            resolve();
          });
          stream.on("error", (err) => {
            logger.error(`input buffered stream error`, err);
            return reject(err);
          });
        });
      },
      onFinish: async () => {
        await promisify(unlink)(file);
      },
    });
    return stream;
  }

  createBufferedOutputStream(options: Options): Readable {
    const stream = new PassThrough();
    const file = getTmpPath("ffmpeg-");
    this.pipes.push({
      type: "output",
      options,
      file,
      onFinish: async () => {
        await new Promise<void>((resolve, reject): void => {
          const reader = createReadStream(file);
          reader.pipe(stream);
          reader.on("end", () => {
            logger.debug("output buffered stream end");
            resolve();
          });
          reader.on("error", (err: Error) => {
            logger.error(`output buffered stream error`, err);
            reject(err);
          });
        });
        await promisify(unlink)(file);
      },
    });
    return stream;
  }

  async run(): Promise<void> {
    const pipes: Pipe[] = [];
    try {
      for (const pipe of this.pipes) {
        logger.debug(`prepare ${pipe.type}`);
        await pipe.onBegin?.();
        pipes.push(pipe);
      }

      const command = ["-y", "-v", "verbose", ...this.getSpawnArgs()];
      const stdio = this.getStdioArg();
      logger.log(`spawn: ${FFMPEG_PATH} ${command.join(" ")}`);
      logger.log(`spawn stdio: ${stdio.join(" ")}`);
      this.process = spawn(FFMPEG_PATH, command, { stdio });
      const finished = this.handleProcess();

      for (const pipe of this.pipes) {
        pipe.onSpawn?.(this.process);
      }

      if (this.killed) {
        // the converter was already killed so stop it immediately
        this.process.kill();
      }

      await finished;
    } catch (e) {
      logger.error(e);
      sendMessageToController({
        type: "message",
        title: "変換中にエラーが発生しました",
        message: `エラー内容:\n${encodeJson(e)}`,
      });
    } finally {
      for (const pipe of pipes) {
        await pipe.onFinish?.();
      }
    }
  }

  stop(): void {
    this.process?.kill("SIGINT");
  }

  kill(): void {
    // kill the process if it already started
    this.process?.kill();
    // set the flag so it will be killed after it's initialized
    this.killed = true;
  }

  private getUniqueFd(): number {
    return this.fdCount++ + 3;
  }

  private getStdioArg(): Array<"ignore" | "pipe"> {
    return [
      "ignore",
      "ignore",
      "pipe",
      ...Array<"pipe">(this.fdCount).fill("pipe"),
    ];
  }

  private getSpawnArgs(): string[] {
    const command: string[] = [];

    for (const pipe of this.pipes) {
      if (pipe.type !== "input") continue;
      command.push(...getArgs(pipe.options));
      command.push("-i", pipe.file);
    }
    for (const pipe of this.pipes) {
      if (pipe.type !== "output") continue;
      command.push(...getArgs(pipe.options));
      command.push(pipe.file);
    }

    return command;
  }

  private async handleProcess(): Promise<void> {
    await new Promise<void>((resolve, reject): void => {
      let logSectionNum = 0;

      if (this.process == null) return reject(Error(`Converter not started`));

      if (this.process.stderr != null) {
        this.process.stderr.setEncoding("utf8");

        this.process.stderr.on("data", (data: string) => {
          const lines = data.split(/\r\n|\r|\n/u);
          for (const line of lines) {
            // skip empty lines
            if (/^\s*$/u.exec(line) != null) continue;
            // if not indented: increment section counter
            if (/^\s/u.exec(line) == null) logSectionNum++;
            // only log sections following the first one
            if (logSectionNum > 1) {
              logger.log("[ffmpeg]", line);
            }
          }
        });
      }

      this.process.on("error", (err) => {
        logger.error("[ffmpeg]", err);
        return reject(err);
      });

      this.process.on("exit", (code, signal) => {
        logger.log(
          `exit: code=${code ?? "unknown"} sig=${signal ?? "unknown"}`,
        );
        if (code == null) return resolve();
        if (EXIT_CODES.includes(code)) return resolve();
        reject(Error(`Converting failed`));
      });
    });
  }
}
