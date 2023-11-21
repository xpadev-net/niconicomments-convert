import {
  ChatOutlined,
  DownloadingOutlined,
  SettingsOutlined,
  SlideshowOutlined,
  SubtitlesOutlined,
} from "@mui/icons-material";
import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
} from "@mui/material";
import Button from "@mui/material/Button";
import { useAtom, useAtomValue } from "jotai";
import type { FC } from "react";
import { useState } from "react";

import { isLoadingAtom, messageAtom } from "@/controller/atoms";
import { Comment } from "@/controller/comment";
import { Convert } from "@/controller/convert";
import { Movie } from "@/controller/movie";
import { QueueDisplay } from "@/controller/queue";
import { Setting } from "@/controller/setting";
import { Sidebar } from "@/controller/sidebar";

import Styles from "./controller.module.scss";

const items = [
  {
    id: "convert",
    icon: SubtitlesOutlined,
    label: "変換",
    component: Convert,
  },
  {
    id: "movieDownload",
    icon: SlideshowOutlined,
    label: "動画",
    component: Movie,
  },
  {
    id: "commentDownload",
    icon: ChatOutlined,
    label: "コメント",
    component: Comment,
  },
  {
    id: "queue",
    icon: DownloadingOutlined,
    label: "キュー",
    component: QueueDisplay,
  },
  {
    id: "setting",
    icon: SettingsOutlined,
    label: "設定",
    component: Setting,
  },
];

const Controller: FC = () => {
  const [tab, setTab] = useState<string>("convert");
  const [message, setMessage] = useAtom(messageAtom);
  const isLoading = useAtomValue(isLoadingAtom);
  return (
    <>
      <div className={Styles.wrapper}>
        <div className={Styles.tab}>
          <Sidebar pages={items} value={tab} onChange={(val) => setTab(val)} />
        </div>
        <div className={Styles.main}>
          {items.map((item) => {
            return (
              <div
                className={`${Styles.tabItem} ${
                  item.id === tab && Styles.active
                }`}
                key={item.id}
              >
                <item.component />
              </div>
            );
          })}
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
