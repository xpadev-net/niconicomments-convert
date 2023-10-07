import { FC, useState } from "react";
import Styles from "./sidebar.module.scss";

type props = {
  pages: {
    id: string;
    icon: FC;
    component: FC;
  }[];
};

const Sidebar = ({ pages }: props) => {
  const [openingPage, setOpeningPage] = useState<string | undefined>(undefined);
  const togglePage = (i: string) => {
    if (i === openingPage) {
      setOpeningPage(undefined);
    } else {
      setOpeningPage(i);
    }
  };
  return (
    <div className={Styles.wrapper}>
      {pages.map((page) => {
        return (
          <div key={page.id}>
            <div
              onClick={() => togglePage(page.id)}
              className={`${Styles.icon} ${
                openingPage === page.id && Styles.active
              }`}
            >
              <page.icon />
            </div>
            <div
              className={`${Styles.overlay} ${
                openingPage === "queue" && Styles.visible
              }`}
              onClick={() => setOpeningPage(undefined)}
            >
              <div
                className={Styles.container}
                onClick={(e) => e.stopPropagation()}
              >
                <page.component />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export { Sidebar };
