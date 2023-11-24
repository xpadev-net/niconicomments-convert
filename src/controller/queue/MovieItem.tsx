import { StopOutlined } from "@mui/icons-material";
import { IconButton } from "@mui/material";
import type { FC } from "react";
import { useMemo } from "react";

import type { MovieQueue, TRemoteMovieItemFormat } from "@/@types/queue";
import { GridDisplay } from "@/controller/display";
import { StatusDisplay } from "@/controller/queue/StatusDisplay";

import Styles from "./ConvertItem.module.scss";

type Props = {
  queue: MovieQueue;
  className: string;
};
const MovieItem: FC<Props> = ({ queue, className }) => {
  return useMemo(() => {
    return (
      <div className={`${Styles.queue} ${className}`}>
        <p className={Styles.id}>#{queue.id}</p>
        <div className={Styles.path}>
          <GridDisplay label={"入力"} value={queue.url} />
          <GridDisplay label={"出力"} value={queue.path} />
          <FormatDisplay format={queue.format} />
        </div>
        <StatusDisplay queue={queue} />
      </div>
    );
  }, [queue]);
};

type FormatDisplayProps = {
  format: TRemoteMovieItemFormat;
};

const FormatDisplay: FC<FormatDisplayProps> = ({ format }) => {
  return (
    <>
      {format.type === "dmc" && (
        <>
          <GridDisplay label={"映像"} value={format.format.video.slice(8)} />
          <GridDisplay label={"音声"} value={format.format.audio.slice(8)} />
        </>
      )}
      {format.type === "dms" && (
        <>
          <GridDisplay label={"映像"} value={format.format[0]} />
          <GridDisplay label={"音声"} value={format.format[1]} />
        </>
      )}
    </>
  );
};

export { MovieItem };
