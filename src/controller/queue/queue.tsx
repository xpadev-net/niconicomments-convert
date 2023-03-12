import type { Queue } from "@/@types/queue";
import { CommentItem } from "@/controller/queue/CommentItem";
import { ConvertItem } from "@/controller/queue/ConvertItem";
import { MovieItem } from "@/controller/queue/MovieItem";
import { typeGuard } from "@/typeGuard";
import { useEffect, useState } from "react";
import Styles from "./queue.module.scss";

const QueueDisplay = () => {
  const [queue, setQueue] = useState<Queue[]>([]);
  useEffect(() => {
    const callback = (_: unknown, e: unknown) => {
      if (typeGuard.controller.progress(e)) {
        setQueue(e.data);
      }
    };
    window.api.onResponse(callback);
    return () => window.api.remove(callback);
  }, []);
  return (
    <div className={Styles.wrapper}>
      {queue.map((item) =>
        item.type === "convert" ? (
          <ConvertItem key={item.id} queue={item} />
        ) : item.type === "movie" ? (
          <MovieItem key={item.id} queue={item} />
        ) : (
          <CommentItem key={item.id} queue={item} />
        )
      )}
    </div>
  );
};
export { QueueDisplay };
