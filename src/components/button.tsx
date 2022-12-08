import type { ReactNode } from "react";
import Styles from "./button.module.scss";

type props = {
  disabled?: boolean;
  children?: ReactNode;
};
const Button = (props: props) => {
  return (
    <button disabled={props.disabled} className={Styles.button}>
      {props.children}
    </button>
  );
};

export { Button };
