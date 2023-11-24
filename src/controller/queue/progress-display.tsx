import { LinearProgress } from "@mui/material";
import type { FC } from "react";

import Styles from "@/controller/queue/convert-item.module.scss";

type Props = {
  progress: number | undefined;
};

const ProgressDisplay: FC<Props> = ({ progress }) => {
  if (typeof progress === "undefined" || isNaN(progress)) {
    return <LinearProgress className={Styles.progress} />;
  }
  return (
    <>
      <LinearProgress
        variant="determinate"
        value={progress * 100}
        className={Styles.progress}
      />
      <span className={Styles.text}>{Math.floor(progress * 100)}%</span>
    </>
  );
};

export { ProgressDisplay };
