import type { FC } from "react";
import { useMemo } from "react";

import type { ConvertQueue } from "@/@types/queue";
import { GridDisplay } from "@/controller/display";
import { StatusDisplay } from "@/controller/queue/status-display";

import Styles from "./convert-item.module.scss";

type Props = {
  queue: ConvertQueue;
  className: string;
};
const ConvertItem: FC<Props> = ({ queue, className }) => {
  return useMemo(() => {
    return (
      <div className={`${Styles.queue} ${className}`}>
        <p className={Styles.id}>#{queue.id}</p>
        <div className={Styles.path}>
          <GridDisplay label={"動画"} value={queue.movie.path} />
          <GridDisplay label={"コメント"} value={queue.comment.path} />
          <GridDisplay label={"出力"} value={queue.output.path} />
        </div>
        <StatusDisplay queue={queue} />
      </div>
    );
  }, [queue, className]);
};
export { ConvertItem };
