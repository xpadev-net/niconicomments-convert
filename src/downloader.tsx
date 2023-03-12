import type { apiResponseType } from "@/@types/types";
import { useEffect, useState } from "react";
import Styles from "./downloader.module.scss";
import { typeGuard } from "./typeGuard";

const Downloader = () => {
  const [progress, setProgress] = useState("");
  useEffect(() => {
    const eventHandler = (_: unknown, data: apiResponseType) => {
      if (data.target !== "downloader") return;
      if (typeGuard.binaryDownloader.progress(data)) {
        setProgress(`step: ${data.step} / ${Math.floor(data.progress * 100)}%`);
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
      <p>環境によっては5分ほどかかる場合があります</p>
      <p>{progress}</p>
    </div>
  );
};
export { Downloader };
