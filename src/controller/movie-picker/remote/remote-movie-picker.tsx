import { FormControlLabel, Radio, RadioGroup, TextField } from "@mui/material";
import Button from "@mui/material/Button";
import { useSetAtom } from "jotai";
import type { ChangeEvent, FC } from "react";
import { useState } from "react";

import type { TWatchV3Metadata } from "@/@types/niconico";
import type { TMovieItemRemote, TRemoteMovieItemFormat } from "@/@types/queue";
import type { TRemoteServerType } from "@/@types/queue";
import { isLoadingAtom, messageAtom } from "@/controller/atoms";
import Styles from "@/controller/movie/movie.module.scss";
import { DeliveryMoviePicker } from "@/controller/movie-picker/remote/delivery";
import { DomandMoviePicker } from "@/controller/movie-picker/remote/domand";
import { typeGuard } from "@/typeGuard";
import { getNicoId, isNicovideoUrl } from "@/util/niconico";
import { uuid } from "@/util/uuid";

type Props = {
  onChange: (val: TMovieItemRemote | undefined) => void;
};

const RemoteMoviePicker: FC<Props> = ({ onChange }) => {
  const [url, setUrl] = useState("");
  const [metadata, setMetadata] = useState<TWatchV3Metadata | undefined>();
  const [mediaServer, setMediaServer] = useState<TRemoteServerType>("delivery");
  const [format, setFormat] = useState<TRemoteMovieItemFormat | undefined>();
  const setMessage = useSetAtom(messageAtom);
  const setIsLoading = useSetAtom(isLoadingAtom);
  const onUrlChange = (e: ChangeEvent<HTMLInputElement>): void => {
    setMetadata(undefined);
    setUrl(e.target.value);
  };
  const getFormats = (): void => {
    void (async () => {
      const nicoId = getNicoId(url);
      if (!isNicovideoUrl(url) || metadata || !nicoId) {
        if (!url) return;
        setMessage({
          title: "URLが正しくありません",
          content:
            "以下のような形式のURLを入力してください\nhttps://www.nicovideo.jp/watch/sm9\nhttps://nico.ms/sm9",
        });
        return;
      }
      setIsLoading(true);
      const targetMetadata = (await window.api.request({
        type: "getNiconicoMovieMetadata",
        nicoId: nicoId,
        host: "controller",
      })) as TWatchV3Metadata;
      setIsLoading(false);
      if (!targetMetadata) {
        setMessage({
          title: "動画情報の取得に失敗しました",
          content: "動画が削除などされていないか確認してください",
        });
        return;
      }
      if (!targetMetadata.data.media.delivery) {
        setMessage({
          title: "動画情報の取得に失敗しました",
          content: "未購入の有料動画などの可能性があります",
        });
        return;
      }
      setMediaServer(targetMetadata.data.media.domand ? "domand" : "delivery");
      setMetadata(targetMetadata);
    })();
  };
  const onClick = (): void => {
    void (async () => {
      const nicoId = getNicoId(url);
      if (!nicoId) {
        setMessage({
          title: "URLが正しくありません",
          content:
            "以下のような形式のURLを入力してください\nhttps://www.nicovideo.jp/watch/sm9\nhttps://nico.ms/sm9",
        });
        return;
      }
      if (!format || !metadata) {
        return;
      }
      setIsLoading(true);
      const output = await window.api.request({
        type: "selectOutput",
        host: "controller",
        options: {
          filters: [{ name: "mp4", extensions: ["mp4"] }],
          properties: ["createDirectory"],
          defaultPath: `${nicoId}.mp4`,
        },
      });
      setIsLoading(false);
      if (typeof output !== "string") {
        return;
      }
      setMessage(undefined);
      onChange({
        type: "remote",
        path: output,
        duration: metadata.data.video.duration,
        ref: {
          id: uuid(),
          status: "queued",
          type: "movie",
          url: nicoId,
          format: format,
          path: output,
          progress: 0,
        },
      });
    })();
  };
  return (
    <div>
      <TextField
        className={Styles.input}
        label="URL"
        placeholder={"https://www.nicovideo.jp/watch/sm9"}
        variant="standard"
        value={url}
        onChange={onUrlChange}
        onBlur={getFormats}
        fullWidth={true}
      />
      {metadata && (
        <>
          <RadioGroup
            value={mediaServer}
            onChange={(e) =>
              setMediaServer(e.target.value as TRemoteServerType)
            }
            row
          >
            <FormControlLabel
              value={"delivery"}
              control={<Radio />}
              label={"delivery"}
              disabled={!metadata.data.media.delivery}
            />
            <FormControlLabel
              value={"domand"}
              control={<Radio />}
              disabled={!metadata.data.media.domand}
              label={"domand"}
            />
          </RadioGroup>
          {mediaServer === "delivery" &&
            typeGuard.controller.v3Delivery(metadata) && (
              <DeliveryMoviePicker metadata={metadata} onChange={setFormat} />
            )}
          {mediaServer === "domand" &&
            typeGuard.controller.v3Domand(metadata) && (
              <DomandMoviePicker metadata={metadata} onChange={setFormat} />
            )}
          <Button variant={"outlined"} onClick={onClick}>
            確定
          </Button>
        </>
      )}
    </div>
  );
};

export { RemoteMoviePicker };
