import { useContext, useState } from "react";
import { TextField } from "@mui/material";
import Styles from "./movie.module.scss";
import Button from "@mui/material/Button";
import { generateUuid } from "@/util/uuid";
import { messageContext } from "@/controller/context/Message";
import { loadingContext } from "@/controller/context/Loading";

const Movie = () => {
  const [url, setUrl] = useState("");
  const { setMessage } = useContext(messageContext);
  const { setIsLoading } = useContext(loadingContext);
  if (!setMessage || !setIsLoading) return <></>;
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
      setIsLoading(true);
      const output = await window.api.request({
        type: "selectOutput",
        host: "controller",
      });
      if (typeof output !== "string") {
        setIsLoading(false);
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
      setIsLoading(false);
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
    </div>
  );
};
export { Movie };
