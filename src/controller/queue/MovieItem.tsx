import type { FC } from "react";
import { useMemo } from "react";

import type { MovieQueue } from "@/@types/queue";
import { ProgressDisplay } from "@/controller/queue/ProgressDisplay";

import Styles from "./ConvertItem.module.scss";

type Props = {
  queue: MovieQueue;
  className: string;
};
const MovieItem: FC<Props> = ({ queue, className }) => {
  return useMemo(() => {
    const outputName = queue.path.split(/\/|\\/g).reverse()[0];
    const url = queue.url.split(/\/|\\/g).reverse()[0];
    if (queue.status !== "processing") {
      return (
        <div className={`${Styles.queue} ${className}`}>
          <p>id: {url}</p>
          <p>video: {queue.format.video.slice(8)}</p>
          <p>audio: {queue.format.audio.slice(8)}</p>
          <p>output: {outputName}</p>
          <p>status: {queue.status}</p>
        </div>
      );
    }

    return (
      <div className={`${Styles.queue} ${className}`}>
        <p>id: {url}</p>
        <p>video: {queue.format.video.slice(8)}</p>
        <p>audio: {queue.format.audio.slice(8)}</p>
        <p>path: {outputName}</p>
        <p>status: processing</p>
        <div className={Styles.progressWrapper}>
          <ProgressDisplay progress={queue.progress} />
        </div>
      </div>
    );
  }, [queue]);
};
export { MovieItem };
