import type { FC } from "react";

import Styles from "./grid-display.module.scss";

type Props = {
  label: string;
  value: string;
};

const GridDisplay: FC<Props> = ({ label, value }) => {
  return (
    <div className={Styles.wrapper}>
      <span className={Styles.label}>{label}</span>
      <span className={Styles.content}>{value}</span>
    </div>
  );
};

export { GridDisplay };
