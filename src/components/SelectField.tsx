import { ReactElement } from "react";
import { FormControl, InputLabel } from "@mui/material";

type props = {
  children: ReactElement;
  label: string;
  className?: string;
};

const SelectField = ({ children, label, className }: props) => {
  return (
    <FormControl variant="standard" className={className}>
      <InputLabel>{label}</InputLabel>
      {children}
    </FormControl>
  );
};

export { SelectField };
