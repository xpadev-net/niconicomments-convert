import type { FC } from "react";

import type { Queue, Status } from "@/@types/queue";
import Styles from "@/controller/queue/ConvertItem.module.scss";
import { ProgressDisplay } from "@/controller/queue/ProgressDisplay";

const labels: { [key in Status]: string } = {
  queued: "他のキューの終了を待っています",
  processing: "処理中...",
  completed: "完了しました",
  fail: "失敗しました",
  interrupted: "中断されました",
};

type Props = {
  queue: Queue;
};

const StatusDisplay: FC<Props> = ({ queue }) => {
  if (queue.type === "convert" && queue.status === "processing") {
    const targetFrameRate = queue.option.fps || 30;
    const totalFrames =
      Math.ceil(
        (queue.option.to || queue.movie.duration) - (queue.option.ss || 0),
      ) * targetFrameRate;
    const progress = queue.progress ? queue.progress / totalFrames : undefined;
    return (
      <div className={Styles.progressWrapper}>
        <ProgressDisplay progress={progress} />
      </div>
    );
  }
  return (
    <div>
      <span>{labels[queue.status]}</span>
    </div>
  );
};

export { StatusDisplay };
