import type { FC } from "react";
import { useMemo } from "react";

import type { ConvertQueue } from "@/@types/queue";
import { ProgressDisplay } from "@/controller/queue/ProgressDisplay";

import Styles from "./ConvertItem.module.scss";

type Props = {
  queue: ConvertQueue;
  className: string;
};
const ConvertItem: FC<Props> = ({ queue, className }) => {
  return useMemo(() => {
    const movieName = queue.movie.path.split(/[/\\]+/g).reverse()[0];
    const outputName = queue.output.path.split(/[/\\]+/g).reverse()[0];
    if (queue.status !== "processing") {
      return (
        <div className={`${Styles.queue} ${className}`}>
          <p>input: {movieName}</p>
          <p>output: {outputName}</p>
          <p>status: {queue.status}</p>
        </div>
      );
    }

    const targetFrameRate = queue.option.fps || 30;
    const totalFrames =
      Math.ceil(
        (queue.option.to || queue.movie.duration) - (queue.option.ss || 0),
      ) * targetFrameRate;
    const progress = queue.progress ? queue.progress / totalFrames : undefined;

    return (
      <div className={`${Styles.queue} ${className}`}>
        <p>input: {movieName}</p>
        <p>output: {outputName}</p>
        <p>status: processing</p>
        <div className={Styles.progressWrapper}>
          <ProgressDisplay progress={progress} />
        </div>

        <button
          onClick={() => {
            void window.api.request({
              host: "controller",
              type: "interruptQueue",
              queueId: queue.id,
            });
          }}
        >
          interrupt
        </button>
      </div>
    );
  }, [queue]);
};
export { ConvertItem };
