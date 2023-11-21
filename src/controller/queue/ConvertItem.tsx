import {
  DescriptionOutlined,
  MovieFilterOutlined,
  StopOutlined,
  VideoFileOutlined,
} from "@mui/icons-material";
import type { FC } from "react";
import { useMemo } from "react";

import type { ConvertQueue } from "@/@types/queue";
import { PathDisplay } from "@/controller/queue/PathDisplay";
import { StatusDisplay } from "@/controller/queue/StatusDisplay";

import Styles from "./ConvertItem.module.scss";

type Props = {
  queue: ConvertQueue;
  className: string;
};
const ConvertItem: FC<Props> = ({ queue, className }) => {
  return useMemo(() => {
    return (
      <div className={`${Styles.queue} ${className}`}>
        <PathDisplay label={"動画"} path={queue.movie.path} />
        <PathDisplay label={"コメント"} path={queue.comment.path} />
        <PathDisplay label={"出力"} path={queue.output.path} />
        <StatusDisplay queue={queue} />
        {queue.status === "processing" && (
          <button
            onClick={() => {
              void window.api.request({
                host: "controller",
                type: "interruptQueue",
                queueId: queue.id,
              });
            }}
          >
            <StopOutlined />
          </button>
        )}
      </div>
    );
  }, [queue]);
};
export { ConvertItem };
