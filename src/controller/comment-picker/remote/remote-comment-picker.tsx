import { FormControlLabel, Radio, RadioGroup, TextField } from "@mui/material";
import Button from "@mui/material/Button";
import { useSetAtom } from "jotai";
import type { ChangeEvent, FC, KeyboardEvent } from "react";
import { useRef, useState } from "react";

import type {
  TCommentOption,
  TCommentPickerMode,
  TWatchV3Metadata,
} from "@/@types/niconico";
import type { TCommentItemRemote } from "@/@types/queue";
import { CommentOption } from "@/components/CommentOption";
import { isLoadingAtom, messageAtom } from "@/controller/atoms";
import { getNicoId, isNicovideoUrl } from "@/util/niconico";
import { formatDate } from "@/util/time";
import { uuid } from "@/util/uuid";

import Styles from "./remote-comment-picker.module.scss";

type Props = {
  onChange: (val: TCommentItemRemote | undefined) => void;
};

const RemoteCommentPicker: FC<Props> = ({ onChange }) => {
  const [url, setUrl] = useState("");
  const [metadata, setMetadata] = useState<TWatchV3Metadata | undefined>();
  const [mode, setMode] = useState<TCommentPickerMode>("simple");
  const [commentOption, setCommentOption] = useState<
    TCommentOption | undefined
  >(undefined);
  const setMessage = useSetAtom(messageAtom);
  const setIsLoading = useSetAtom(isLoadingAtom);
  const lastUrl = useRef<string>("");

  const onUrlChange = (e: ChangeEvent<HTMLInputElement>): void => {
    setMetadata(undefined);
    setUrl(e.target.value);
  };
  const updateMetadata = (): void => {
    void (async () => {
      const nicoId = getNicoId(url);
      if (!isNicovideoUrl(url) || metadata || !nicoId) {
        if (!url || lastUrl.current === nicoId) return;
        setMessage({
          title: "URLが正しくありません",
          content:
            "以下のような形式のURLを入力してください\nhttps://www.nicovideo.jp/watch/sm9\nhttps://nico.ms/sm9\ncontroller/movie-picker/remote/remote-movie-picker.tsx / getFormats",
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
      setMetadata(targetMetadata);
      setMode(targetMetadata.data.viewer === null ? "simple" : "custom");
      lastUrl.current = nicoId;
    })();
  };
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>): void => {
    if (e.key !== "Enter") return;
    updateMetadata();
  };
  const onClick = (): void => {
    void (async () => {
      const nicoId = getNicoId(url);
      if (!nicoId || !commentOption || !metadata) return;
      setIsLoading(true);
      const output = await window.api.request({
        type: "selectOutput",
        host: "controller",
        options: {
          filters: [{ name: "xml", extensions: ["xml"] }],
          properties: ["createDirectory"],
          defaultPath: `${nicoId}.xml`,
        },
      });
      setIsLoading(false);
      if (typeof output !== "string") return;
      onChange({
        type: "remote",
        path: output,
        format: "XMLDocument",
        ref: {
          id: uuid(),
          type: "comment",
          url: nicoId,
          option: commentOption,
          metadata: metadata.data.comment,
          path: output,
          status: "queued",
          progress: 0,
        },
      });
    })();
  };

  return (
    <div className={Styles.wrapper}>
      <TextField
        className={Styles.input}
        label="URL"
        placeholder={"https://www.nicovideo.jp/watch/sm9"}
        variant="standard"
        value={url}
        onChange={onUrlChange}
        onBlur={updateMetadata}
        onKeyDown={onKeyDown}
        fullWidth={true}
      />
      {metadata && (
        <RadioGroup
          value={mode}
          onChange={(e) => setMode(e.target.value as TCommentPickerMode)}
          row
        >
          <FormControlLabel
            value={"simple"}
            control={<Radio />}
            label={"簡易"}
          />
          <FormControlLabel
            value={"custom"}
            control={<Radio />}
            label={"カスタム"}
            disabled={metadata.data.viewer === null}
          />
        </RadioGroup>
      )}
      {metadata && (
        <>
          <CommentOption
            update={setCommentOption}
            metadata={metadata.data.comment}
            postedDate={formatDate(new Date(metadata.data.video.registeredAt))}
            mode={mode}
          />
          <div>
            <Button
              variant={"outlined"}
              onClick={onClick}
              disabled={!commentOption || !metadata}
            >
              確定
            </Button>
          </div>
        </>
      )}
    </div>
  );
};
export { RemoteCommentPicker };
