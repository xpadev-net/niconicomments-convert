import type { FC } from "react";

import Styles from "./PathDisplay.module.scss";

type Props = {
  label: string;
  path: string;
};

const PathDisplay: FC<Props> = ({ label, path }) => {
  return (
    <div className={Styles.wrapper}>
      <span className={Styles.label}>{label}</span>
      <span className={Styles.content}>{path}</span>
    </div>
  );
};

export { PathDisplay };
