import { MenuItem, Select, TextField } from "@mui/material";
import Button from "@mui/material/Button";
import { useSetAtom } from "jotai";
import type { ChangeEvent, FC } from "react";
import { useState } from "react";

import type {
  TWatchV3Metadata,
  V3MetadataAudioItem,
  V3MetadataVideoItem,
} from "@/@types/niconico";
import type { TMovieItemRemote } from "@/@types/queue";
import { SelectField } from "@/components/SelectField";
import { isLoadingAtom, messageAtom } from "@/controller/atoms";
import Styles from "@/controller/movie/movie.module.scss";
import { getNicoId, isNicovideoUrl } from "@/util/niconico";
import { uuid } from "@/util/uuid";

type Props = {
  onChange: (val: TMovieItemRemote | undefined) => void;
};

const RemoteMoviePicker: FC<Props> = ({ onChange }) => {
  const [url, setUrl] = useState("");
  const [metadata, setMetadata] = useState<TWatchV3Metadata | undefined>();
  const [selectedVideo, setSelectedVideo] = useState<string>("");
  const [selectedAudio, setSelectedAudio] = useState<string>("");
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
      setMetadata(targetMetadata);
      setSelectedAudio(
        getBestSegment(targetMetadata.data.media.delivery.movie.audios).id,
      );
      setSelectedVideo(
        getBestSegment(targetMetadata.data.media.delivery.movie.videos).id,
      );
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
      if (!selectedVideo || !selectedAudio || !metadata) {
        return;
      }
      setIsLoading(true);
      const output = await window.api.request({
        type: "selectOutput",
        host: "controller",
        options: {
          filters: [{ name: "mp4", extensions: ["mp4"] }],
          properties: ["createDirectory"],
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
          format: { audio: selectedAudio, video: selectedVideo },
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
          <SelectField label={"動画"} className={Styles.input}>
            <Select
              label={"動画"}
              variant={"standard"}
              value={selectedVideo}
              defaultValue={
                getBestSegment(metadata.data.media.delivery.movie.videos).id
              }
              className={Styles.input}
              onChange={(e) => setSelectedVideo(e.target.value)}
            >
              {metadata.data.media.delivery.movie.videos.map((val) => {
                if (!val.isAvailable) return <></>;
                return (
                  <MenuItem key={val.id} value={val.id}>
                    {val.id}
                  </MenuItem>
                );
              })}
            </Select>
          </SelectField>
          <SelectField label={"音声"} className={Styles.input}>
            <Select
              label={"音声"}
              variant={"standard"}
              className={Styles.input}
              defaultValue={
                getBestSegment(metadata.data.media.delivery.movie.audios).id
              }
              value={selectedAudio}
              onChange={(e) => setSelectedAudio(e.target.value)}
            >
              {metadata.data.media.delivery.movie.audios.map((val) => {
                return (
                  <MenuItem key={val.id} value={val.id}>
                    {val.id}
                  </MenuItem>
                );
              })}
            </Select>
          </SelectField>
          <Button variant={"outlined"} onClick={onClick}>
            確定
          </Button>
        </>
      )}
    </div>
  );
};

function getBestSegment<T extends V3MetadataAudioItem | V3MetadataVideoItem>(
  input: T[],
): T {
  let bestItem = input[0];
  for (const item of input) {
    if (!item.isAvailable) continue;
    if (bestItem.metadata.bitrate < item.metadata.bitrate) {
      bestItem = item;
    }
  }
  return bestItem;
}

export { RemoteMoviePicker };
