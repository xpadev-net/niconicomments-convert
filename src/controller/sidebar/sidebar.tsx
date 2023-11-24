import { Menu } from "@mui/icons-material";
import type { FC } from "react";
import { useState } from "react";

import Styles from "./sidebar.module.scss";

type Props = {
  pages: {
    id: string;
    icon: FC;
    label: string;
  }[];
  onChange: (val: string) => void;
  value: string;
};

const Sidebar: FC<Props> = ({ pages, onChange, value }) => {
  const [extended, setExtended] = useState<boolean>(false);
  return (
    <div className={`${Styles.wrapper} ${extended && Styles.extend}`}>
      <div className={Styles.item} onClick={() => setExtended((pv) => !pv)}>
        <div className={Styles.icon}>
          <Menu />
        </div>
      </div>
      {pages.map((page) => {
        return (
          <div
            key={page.id}
            className={`${Styles.item} ${value === page.id && Styles.active}`}
            onClick={() => onChange(page.id)}
          >
            <div className={Styles.icon}>
              <page.icon />
            </div>
            {extended && (
              <div>
                <span>{page.label}</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export { Sidebar };
