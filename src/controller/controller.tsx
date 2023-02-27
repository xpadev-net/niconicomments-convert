import { Convert } from "@/controller/convert/convert";
import { QueueDisplay } from "@/controller/queue/queue";
import Styles from "./controller.module.scss";
import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Tab,
  Tabs,
} from "@mui/material";
import { useState } from "react";
import { Movie } from "@/controller/movie/movie";
import { Setting } from "@/controller/setting/setting";
import Button from "@mui/material/Button";
import { useAtom, useAtomValue } from "jotai";
import { isLoadingAtom, messageAtom } from "@/controller/atoms";

const Controller = () => {
  const [tab, setTab] = useState<number>(0);
  const [message, setMessage] = useAtom(messageAtom);
  const isLoading = useAtomValue(isLoadingAtom);
  return (
    <>
      <div className={Styles.wrapper}>
        <div className={Styles.main}>
          <Tabs
            variant={"fullWidth"}
            value={tab}
            onChange={(_, value) => setTab(Number(value))}
          >
            <Tab label={"変換"} value={0} />
            <Tab label={"動画"} value={1} />
            <Tab label={"コメント"} value={2} disabled={true} />
            <Tab label={"設定"} value={3} />
          </Tabs>
          <div className={`${Styles.tabItem} ${tab === 0 && Styles.active}`}>
            <Convert />
          </div>
          <div className={`${Styles.tabItem} ${tab === 1 && Styles.active}`}>
            <Movie />
          </div>
          <div className={`${Styles.tabItem} ${Styles.active}`}>
            {tab === 3 && <Setting />}
          </div>
        </div>
        <div className={Styles.queue}>
          <QueueDisplay />
        </div>
      </div>
      <Dialog open={!!message} onClose={() => setMessage(undefined)}>
        <DialogTitle>{message?.title}</DialogTitle>
        <DialogContent>
          <pre>{message?.content}</pre>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMessage(undefined)} autoFocus>
            OK
          </Button>
        </DialogActions>
      </Dialog>
      {isLoading && <div className={Styles.loading}>処理中...</div>}
    </>
  );
};
export { Controller };
