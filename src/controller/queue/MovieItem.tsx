import { MovieQueue } from "@/@types/queue";
import Styles from "./ConvertItem.module.scss";

import { useMemo } from "react";
import { LinearProgress } from "@mui/material";

type props = {
  queue: MovieQueue;
};
const MovieItem = ({ queue }: props) => {
  return useMemo(() => {
    const outputName = queue.path.split(/\/|\\/g).reverse()[0];
    const url = queue.url.split(/\/|\\/g).reverse()[0];
    if (queue.status !== "processing") {
      return (
        <div className={Styles.queue}>
          <p>id: {url}</p>
          <p>video: {queue.format.video.slice(8)}</p>
          <p>audio: {queue.format.audio.slice(8)}</p>
          <p>output: {outputName}</p>
          <p>status: {queue.status}</p>
        </div>
      );
    }

    return (
      <div className={Styles.queue}>
        <p>id: {url}</p>
        <p>video: {queue.format.video.slice(8)}</p>
        <p>audio: {queue.format.audio.slice(8)}</p>
        <p>path: {outputName}</p>
        <p>status: processing</p>
        <div className={Styles.progressWrapper}>
          {isNaN(queue.progress) ? (
            <LinearProgress className={Styles.progress} />
          ) : (
            <>
              <LinearProgress
                variant="determinate"
                value={queue.progress * 100}
                valueBuffer={queue.progress * 100}
                className={Styles.progress}
              />
              <span className={Styles.text}>
                {Math.floor(queue.progress * 100)}%
              </span>
            </>
          )}
        </div>
      </div>
    );
  }, [queue]);
};
export { MovieItem };
