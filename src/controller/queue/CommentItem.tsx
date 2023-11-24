import type { FC } from "react";
import { useMemo } from "react";

import type { CommentQueue } from "@/@types/queue";
import { GridDisplay } from "@/controller/display";
import { StatusDisplay } from "@/controller/queue/StatusDisplay";

import Styles from "./ConvertItem.module.scss";

type Props = {
  queue: CommentQueue;
  className: string;
};
const CommentItem: FC<Props> = ({ queue, className }) => {
  return useMemo(() => {
    return (
      <div className={`${Styles.queue} ${className}`}>
        <p className={Styles.id}>#{queue.id}</p>
        <div className={Styles.path}>
          <GridDisplay label={"入力"} value={queue.url} />
          <GridDisplay label={"出力"} value={queue.path} />
        </div>
        <StatusDisplay queue={queue} />
      </div>
    );
  }, [queue]);
};
export { CommentItem };
