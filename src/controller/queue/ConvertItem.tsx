import { StopOutlined } from "@mui/icons-material";
import { IconButton } from "@mui/material";
import type { FC } from "react";
import { useMemo } from "react";

import type { ConvertQueue } from "@/@types/queue";
import { PathDisplay } from "@/controller/display";
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
        <p className={Styles.id}>#{queue.id}</p>
        <div className={Styles.path}>
          <PathDisplay label={"動画"} path={queue.movie.path} />
          <PathDisplay label={"コメント"} path={queue.comment.path} />
          <PathDisplay label={"出力"} path={queue.output.path} />
        </div>
        <div className={Styles.row}>
          <StatusDisplay queue={queue} />
          {queue.status === "processing" && (
            <IconButton
              onClick={() => {
                void window.api.request({
                  host: "controller",
                  type: "interruptQueue",
                  queueId: queue.id,
                });
              }}
            >
              <StopOutlined />
            </IconButton>
          )}
        </div>
      </div>
    );
  }, [queue]);
};
export { ConvertItem };
