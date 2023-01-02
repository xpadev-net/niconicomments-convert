import { useState } from "react";
import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
} from "@mui/material";
import Styles from "./movie.module.scss";
import Button from "@mui/material/Button";
import { generateUuid } from "@/util/uuid";
import { Message } from "@/@types/types";

const Movie = () => {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<Message | undefined>();
  const download = () => {
    void (async () => {
      if (
        !url.match(
          /^(?:https?:\/\/)?(?:nico\.ms|www.nicovideo.jp\/watch)\/((?:sm|nm|so)?[1-9][0-9]*)(?:.*)?$/
        )
      ) {
        setMessage({
          title: "URLが正しくありません",
          content:
            "以下のような形式のURLを入力してください\nhttps://www.nicovideo.jp/watch/sm9\nhttps://nico.ms/sm9",
        });
        return;
      }
      setLoading(true);
      const output = await window.api.request({
        type: "selectOutput",
        host: "controller",
      });
      if (typeof output !== "string") {
        setLoading(false);
        return;
      }
      await window.api.request({
        type: "appendQueue",
        host: "controller",
        data: {
          type: "movie",
          id: generateUuid(),
          status: "queued",
          progress: 0,
          target: output,
          path: "",
        },
      });
      setLoading(false);
    })();
  };
  return (
    <div className={Styles.wrapper}>
      <div className={Styles.url}>
        <TextField
          className={Styles.input}
          label="URL"
          placeholder={"https://www.nicovideo.jp/watch/sm9"}
          variant="standard"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <Button variant={"outlined"} onClick={download}>
          ダウンロード
        </Button>
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
      {loading && <div className={Styles.loading}>処理中...</div>}
    </div>
  );
};
export { Movie };
