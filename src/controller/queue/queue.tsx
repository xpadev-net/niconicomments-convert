import type { FC } from "react";
import { useEffect, useState } from "react";

import type { Queue } from "@/@types/queue";
import { CommentItem } from "@/controller/queue/CommentItem";
import { ConvertItem } from "@/controller/queue/ConvertItem";
import { MovieItem } from "@/controller/queue/MovieItem";
import { typeGuard } from "@/typeGuard";

import Styles from "./queue.module.scss";

const QueueDisplay: FC = () => {
  const [queue, setQueue] = useState<Queue[]>([]);
  useEffect(() => {
    const callback = (_: unknown, e: unknown): void => {
      if (typeGuard.controller.progress(e)) {
        setQueue(e.data);
      }
    };
    window.api.onResponse(callback);
    return () => window.api.remove(callback);
  }, []);
  return (
    <div className={Styles.wrapper}>
      {queue.length < 1 && <p>タスクはまだありません</p>}
      {queue.map((item) => {
        if (item.type === "convert") {
          return (
            <ConvertItem className={Styles.item} key={item.id} queue={item} />
          );
        }
        if (item.type === "movie") {
          return (
            <MovieItem className={Styles.item} key={item.id} queue={item} />
          );
        }
        return (
          <CommentItem className={Styles.item} key={item.id} queue={item} />
        );
      })}
    </div>
  );
};
export { QueueDisplay };
