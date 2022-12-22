import { Convert } from "@/controller/convert/convert";
import { QueueDisplay } from "@/controller/queue/queue";
import Styles from "./controller.module.scss";
import { Tab, Tabs } from "@mui/material";
import { useState } from "react";

const Controller = () => {
  const [tab, setTab] = useState<number>(0);
  return (
    <div className={Styles.wrapper}>
      <div className={Styles.main}>
        <Tabs
          variant={"fullWidth"}
          value={tab}
          onChange={(_, value) => setTab(Number(value))}
        >
          <Tab label={"変換"} value={0} />
          <Tab label={"動画"} value={1} disabled={true} />
          <Tab label={"コメント"} value={2} disabled={true} />
        </Tabs>
        <div className={`${Styles.tabItem} ${tab === 0 && Styles.active}`}>
          <Convert />
        </div>
      </div>
      <div className={Styles.queue}>
        <QueueDisplay />
      </div>
    </div>
  );
};
export { Controller };
