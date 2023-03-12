import { FormControl, InputLabel } from "@mui/material";
import { ReactElement } from "react";
import Styles from "./SelectField.module.scss";

type props = {
  children: ReactElement;
  label: string;
  className?: string;
};

const SelectField = ({ children, label, className }: props) => {
  return (
    <FormControl variant="standard" className={`${Styles.input} ${className}`}>
      <InputLabel>{label}</InputLabel>
      {children}
    </FormControl>
  );
};

export { SelectField };
