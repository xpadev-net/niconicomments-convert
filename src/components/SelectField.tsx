import { FormControl, InputLabel } from "@mui/material";
import type { FC, ReactElement } from "react";

import Styles from "./SelectField.module.scss";

type Props = {
  children: ReactElement;
  label: string;
  className?: string;
};

const SelectField: FC<Props> = ({ children, label, className }) => {
  return (
    <FormControl variant="standard" className={`${Styles.input} ${className}`}>
      <InputLabel>{label}</InputLabel>
      {children}
    </FormControl>
  );
};

export { SelectField };
