import { ChangeEvent, useState } from "react";
import { TextField } from "@mui/material";
import Styles from "./comment.module.scss";
import { useSetAtom } from "jotai";
import { isLoadingAtom, messageAtom } from "@/controller/atoms";
import { getNicoId, isNicovideoUrl } from "@/util/niconico";
import {
  availableNicovideoApi,
  commentOption,
  watchV3Metadata,
} from "@/@types/niconico";
import { CommentOption } from "@/components/CommentOption";
import { formatDate } from "@/util/time";
import Button from "@mui/material/Button";
import { generateUuid } from "@/util/uuid";

type props = {
  api: availableNicovideoApi;
};

const MetaV3 = ({ api }: props) => {
  const [url, setUrl] = useState("");
  const [metadata, setMetadata] = useState<watchV3Metadata | undefined>();
  const [commentOption, setCommentOption] = useState<commentOption | undefined>(
    undefined
  );
  const setMessage = useSetAtom(messageAtom);
  const setIsLoading = useSetAtom(isLoadingAtom);
  const onUrlChange = (e: ChangeEvent<HTMLInputElement>) => {
    setMetadata(undefined);
    setUrl(e.target.value);
  };
  const updateMetadata = () => {
    void (async () => {
      const nicoId = getNicoId(url);
      if (!isNicovideoUrl(url) || metadata || !nicoId) return;
      setIsLoading(true);
      const targetMetadata = (await window.api.request({
        type: "getNiconicoMovieMetadata",
        nicoId: nicoId,
        host: "controller",
      })) as watchV3Metadata;
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
    })();
  };

  const download = () => {
    const nicoId = getNicoId(url);
    if (!nicoId || !metadata || !commentOption) return;
    void (async () => {
      setIsLoading(true);
      const ext = "xml";
      const output = await window.api.request({
        type: "selectOutput",
        host: "controller",
        options: {
          filters: [{ name: ext, extensions: [ext] }],
          properties: ["createDirectory"],
        },
      });
      if (typeof output !== "string") {
        setIsLoading(false);
        return;
      }
      await window.api.request({
        type: "appendQueue",
        data: {
          id: generateUuid(),
          type: "comment",
          target: nicoId,
          api: api,
          metadata: metadata.data.comment,
          option: commentOption,
          progress: 0,
          path: output,
          status: "queued",
        },
        host: "controller",
      });
      setUrl("");
      setMetadata(undefined);
      setCommentOption(undefined);
      setIsLoading(false);
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
        fullWidth={true}
      />
      {metadata && (
        <CommentOption
          update={setCommentOption}
          metadata={metadata.data.comment}
          postedDate={formatDate(new Date(metadata.data.video.registeredAt))}
        />
      )}
      <Button
        variant={"outlined"}
        onClick={download}
        disabled={!commentOption || !metadata}
        className={Styles.input}
      >
        ダウンロード
      </Button>
    </div>
  );
};
export { MetaV3 };
