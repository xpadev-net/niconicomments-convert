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
    if (queue.status !== "processing") {
      return (
        <div className={Styles.queue}>
          <p>input: {queue.target}</p>
          <p>output: {outputName}</p>
          <p>status: {queue.status}</p>
        </div>
      );
    }

    return (
      <div className={Styles.queue}>
        <p>input: {queue.target}</p>
        <p>output: {outputName}</p>
        <p>status: processing</p>
        <div className={Styles.progressWrapper}>
          <LinearProgress
            variant="buffer"
            value={queue.progress * 100}
            valueBuffer={queue.progress * 100}
            className={Styles.progress}
          />
          <span className={Styles.text}>
            {Math.floor(queue.progress * 100)}%
          </span>
        </div>
      </div>
    );
  }, [queue]);
};
export { MovieItem };
