import type { apiResponseType } from "@/@types/types";
import { useEffect, useState } from "react";
import Styles from "./downloader.module.scss";
import { typeGuard } from "./typeGuard";
import { apiResponseDownloadProgress } from "@/@types/response.binaryDownloader";
import { LinearProgress } from "@mui/material";

const Downloader = () => {
  const [progress, setProgress] = useState<
    apiResponseDownloadProgress | undefined
  >();
  useEffect(() => {
    const eventHandler = (_: unknown, data: apiResponseType) => {
      if (data.target !== "downloader") return;
      if (typeGuard.binaryDownloader.progress(data)) {
        setProgress(data);
      }
    };
    window.api.onResponse(eventHandler);
    return () => {
      window.api.remove(eventHandler);
    };
  }, []);

  return (
    <div className={Styles.wrapper}>
      <p>必要なファイルをダウンロードしています...</p>
      <p>環境によっては数分かかる場合があります</p>
      <p>{progress?.name}をダウンロード中...</p>
      <div className={Styles.progressWrapper}>
        <LinearProgress
          variant={"determinate"}
          value={(progress?.progress || 0) * 100}
          className={Styles.progress}
        />
        <span className={Styles.text}>
          {Math.floor((progress?.progress || 0) * 100)}%
        </span>
      </div>
    </div>
  );
};
export { Downloader };
