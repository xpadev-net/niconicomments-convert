import type { FC } from "react";
import { useMemo } from "react";

import type { MovieQueue, TRemoteMovieItemFormat } from "@/@types/queue";
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
          <FormatDisplay format={queue.format} />
          <p>output: {outputName}</p>
          <p>status: {queue.status}</p>
        </div>
      );
    }

    return (
      <div className={`${Styles.queue} ${className}`}>
        <p>id: {url}</p>
        <FormatDisplay format={queue.format} />
        <p>path: {outputName}</p>
        <p>status: processing</p>
        <div className={Styles.progressWrapper}>
          <ProgressDisplay progress={queue.progress} />
        </div>
      </div>
    );
  }, [queue]);
};

type FormatDisplayProps = {
  format: TRemoteMovieItemFormat;
};

const FormatDisplay: FC<FormatDisplayProps> = ({ format }) => {
  return (
    <>
      {format.type === "dmc" && (
        <>
          <p>video: {format.format.video.slice(8)}</p>
          <p>audio: {format.format.audio.slice(8)}</p>
        </>
      )}
      {format.type === "dms" && (
        <>
          <p>video: {format.format[0]}</p>
          <p>audio: {format.format[1]}</p>
        </>
      )}
    </>
  );
};

export { MovieItem };
