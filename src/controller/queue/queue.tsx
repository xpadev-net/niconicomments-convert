import type { FC } from "react";
import { useEffect, useState } from "react";

import type { Queue } from "@/@types/queue";
import { CommentItem } from "@/controller/queue/comment-item";
import { ConvertItem } from "@/controller/queue/convert-item";
import { MovieItem } from "@/controller/queue/movie-item";
import { typeGuard } from "@/type-guard";

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
    void window.api.request({
      type: "getQueue",
      host: "controller",
    });
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
