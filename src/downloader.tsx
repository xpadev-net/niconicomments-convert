import { LinearProgress } from "@mui/material";
import type { FC } from "react";
import { useEffect, useState } from "react";

import type { ApiResponseDownloadProgress } from "@/@types/response.binaryDownloader";
import type { ApiResponseType } from "@/@types/types";

import Styles from "./downloader.module.scss";
import { typeGuard } from "./typeGuard";

const Downloader: FC = () => {
  const [progress, setProgress] = useState<
    ApiResponseDownloadProgress | undefined
  >();
  useEffect(() => {
    const eventHandler = (_: unknown, data: ApiResponseType): void => {
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
