import { Queue } from "@/@types/queue";
import Styles from "./queueItem.module.scss";

import styled from "styled-components";
import { useMemo } from "react";

type progress = {
  width: number;
};

const ProgressItem = styled.div<progress>`
  width: ${(p) => p.width}%;
`;
type props = {
  queue: Queue;
};
const QueueItem = ({ queue }: props) => {
  return useMemo(() => {
    const movieName = queue.movie.path.split(/\/|\\/g).reverse()[0];
    const outputName = queue.output.path.split(/\/|\\/g).reverse()[0];
    if (queue.status !== "processing") {
      return (
        <div className={Styles.queue}>
          <p>input: {movieName}</p>
          <p>output: {outputName}</p>
          <p>status: {queue.status}</p>
        </div>
      );
    }
    const pg = queue.progress;

    return (
      <div className={Styles.queue}>
        <p>input: {movieName}</p>
        <p>output: {outputName}</p>
        <p>status: processing</p>
        <div className={Styles.progressWrapper}>
          <div className={Styles.progress}>
            <span>
              {pg.generated} / {pg.total} (
              {Math.floor((pg.generated / pg.total) * 100)}%)
            </span>
            <ProgressItem
              className={Styles.progressItem}
              width={(pg.generated / pg.total) * 100}
            />
          </div>
          <div className={Styles.progress}>
            <span>
              {pg.converted} / {pg.total} (
              {Math.floor((pg.converted / pg.total) * 100)}%)
            </span>
            <ProgressItem
              className={Styles.progressItem}
              width={(pg.converted / pg.total) * 100}
            />
          </div>
        </div>
      </div>
    );
  }, [queue]);
};
export { QueueItem };
