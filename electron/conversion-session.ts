import { randomUUID } from "node:crypto";

import type { ConvertQueue } from "@/@types/queue.js";

import { createConverter } from "./converter.js";

// All asynchronous frame work keeps a reference to its own converter and queue.
export class ConversionSession {
  readonly id = randomUUID();
  private readonly converter;
  interrupted = false;
  private accepting = true;
  private lastFrame = 0;
  private endFrame: number | undefined;
  private inputEnded = false;
  private readonly frames = new Map<number, Uint8Array>();
  private writes = Promise.resolve();
  private failure: Error | undefined;

  constructor(
    readonly queue: ConvertQueue,
    private readonly onProgress: () => void,
  ) {
    this.converter = createConverter(queue);
    this.converter.inputStream.on("error", this.onError);
  }

  async run(): Promise<void> {
    try {
      await this.converter.run();
      if (this.failure) throw this.failure;
    } catch (error) {
      this.fail(error);
      throw this.failure ?? error;
    } finally {
      await this.dispose();
    }
  }

  async dispose(): Promise<void> {
    this.accepting = false;
    this.frames.clear();
    const stream = this.converter.inputStream;
    const closed = stream.closed
      ? Promise.resolve()
      : new Promise<void>((resolve) => stream.once("close", resolve));
    stream.destroy();
    await Promise.all([closed, this.writes]);
  }

  interrupt(): void {
    if (this.interrupted) return;
    this.interrupted = true;
    this.stop();
  }

  private stop(): void {
    this.accepting = false;
    this.frames.clear();
    // Destroying also releases a write waiting for backpressure to clear.
    this.converter.inputStream.destroy();
    this.converter.stop();
  }

  get failed(): boolean {
    return this.failure !== undefined;
  }

  fail(error: unknown): void {
    if (!this.accepting || this.interrupted) return;
    this.failure = error instanceof Error ? error : new Error(String(error));
    this.stop();
  }

  private readonly onError = (error: Error): void => {
    this.fail(error);
  };

  appendFrame(frameId: number, data: Uint8Array): void {
    if (
      !this.accepting ||
      this.inputEnded ||
      !Number.isSafeInteger(frameId) ||
      frameId <= this.lastFrame ||
      (this.endFrame !== undefined && frameId > this.endFrame)
    )
      return;
    this.frames.set(frameId, data);
    while (this.frames.has(this.lastFrame + 1)) {
      const nextFrame = this.lastFrame + 1;
      const frame = this.frames.get(nextFrame);
      if (!frame) break;
      this.frames.delete(nextFrame);
      this.lastFrame = nextFrame;
      this.writes = this.writes
        .then(async () => {
          if (!this.accepting) return;
          await this.writeFrame(frame);
          if (!this.accepting) return;
          this.queue.progress.processed++;
          this.queue.progress.percent =
            this.queue.progress.processed / this.queue.progress.total;
          this.onProgress();
        })
        .catch(this.onError);
    }
    this.finishInput();
  }

  markAsCompleted(frameId: number): void {
    if (
      !this.accepting ||
      this.endFrame !== undefined ||
      !Number.isSafeInteger(frameId) ||
      frameId < this.lastFrame
    )
      return;
    this.endFrame = frameId;
    this.finishInput();
  }

  private finishInput(): void {
    if (this.inputEnded || this.lastFrame !== this.endFrame) return;
    this.inputEnded = true;
    this.writes = this.writes
      .then(() => {
        if (this.accepting) this.converter.inputStream.end();
      })
      .catch(this.onError);
  }

  private writeFrame(data: Uint8Array): Promise<void> {
    const stream = this.converter.inputStream;
    return new Promise((resolve, reject) => {
      const onClose = () => done();
      const done = (error?: Error | null) => {
        stream.off("close", onClose);
        if (error) reject(error);
        else resolve();
      };
      stream.once("close", onClose);
      stream.write(data, done);
    });
  }
}
