import { useEffect, useState } from "react";
import { typeGuard } from "@/typeGuard";
import { Queue } from "@/@types/queue";
import Styles from "./queue.module.scss";
import { ConvertItem } from "@/controller/queue/ConvertItem";
import { MovieItem } from "@/controller/queue/MovieItem";
import { CommentItem } from "@/controller/queue/CommentItem";

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
