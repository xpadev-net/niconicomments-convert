import { DownloadingOutlined } from "@mui/icons-material";
import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Tab,
  Tabs,
} from "@mui/material";
import Button from "@mui/material/Button";
import { useAtom, useAtomValue } from "jotai";
import type { FC } from "react";
import { useState } from "react";

import { isLoadingAtom, messageAtom } from "@/controller/atoms";
import { Comment } from "@/controller/comment/comment";
import { Convert } from "@/controller/convert/convert";
import { Movie } from "@/controller/movie/movie";
import { QueueDisplay } from "@/controller/queue/queue";
import { Setting } from "@/controller/setting/setting";
import { Sidebar } from "@/controller/sidebar/sidebar";

import Styles from "./controller.module.scss";

const Controller: FC = () => {
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
            <Tab label={"コメント"} value={2} />
            <Tab label={"設定"} value={3} />
          </Tabs>
          <div className={`${Styles.tabItem} ${tab === 0 && Styles.active}`}>
            <Convert />
          </div>
          <div className={`${Styles.tabItem} ${tab === 1 && Styles.active}`}>
            <Movie />
          </div>
          <div className={`${Styles.tabItem} ${tab === 2 && Styles.active}`}>
            <Comment />
          </div>
          <div className={`${Styles.tabItem} ${Styles.active}`}>
            {tab === 3 && <Setting />}
          </div>
        </div>
        <div className={Styles.queue}>
          <Sidebar
            pages={[
              {
                id: "queue",
                icon: DownloadingOutlined,
                component: QueueDisplay,
              },
            ]}
          />
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
