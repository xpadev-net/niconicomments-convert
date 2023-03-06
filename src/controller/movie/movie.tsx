import { ChangeEvent, useState } from "react";
import { MenuItem, Select, TextField } from "@mui/material";
import Styles from "./movie.module.scss";
import Button from "@mui/material/Button";
import { generateUuid } from "@/util/uuid";
import { useSetAtom } from "jotai";
import { isLoadingAtom, messageAtom } from "@/controller/atoms";
import { getNicoId, isNicovideoUrl } from "@/util/niconico";
import { watchV3Metadata } from "@/@types/niconico";
import { SelectField } from "@/components/SelectField";

const Movie = () => {
  const [url, setUrl] = useState("");
  const [metadata, setMetadata] = useState<watchV3Metadata | undefined>();
  const [selectedVideo, setSelectedVideo] = useState<string>("");
  const [selectedAudio, setSelectedAudio] = useState<string>("");
  const setMessage = useSetAtom(messageAtom);
  const setIsLoading = useSetAtom(isLoadingAtom);
  const onUrlChange = (e: ChangeEvent<HTMLInputElement>) => {
    setMetadata(undefined);
    setUrl(e.target.value);
  };
  const getFormats = () => {
    void (async () => {
      const nicoId = getNicoId(url);
      if (!isNicovideoUrl(url) || metadata || !nicoId) return;
      setIsLoading(true);
      const targetMetadata = (await window.api.request({
        type: "getNiconicoMovieMetadata",
        nicoId: nicoId,
        host: "controller",
      })) as watchV3Metadata;
      console.log(targetMetadata);
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
      if (!selectedVideo || !selectedAudio) {
        setMessage({
          title: "フォーマットを選択してください",
          content: "",
        });
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
          url: nicoId,
          format: {
            audio: selectedAudio,
            video: selectedVideo,
          },
          path: output,
        },
      });
      setUrl("");
      setMetadata(undefined);
      setSelectedVideo("");
      setSelectedAudio("");
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
              className={Styles.input}
              onChange={(e) => setSelectedVideo(e.target.value)}
            >
              <MenuItem disabled value="">
                <em>動画を選択してください</em>
              </MenuItem>
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
              value={selectedAudio}
              onChange={(e) => setSelectedAudio(e.target.value)}
            >
              <MenuItem disabled value="">
                <em>音声を選択してください</em>
              </MenuItem>
              {metadata.data.media.delivery.movie.audios.map((val) => {
                return (
                  <MenuItem key={val.id} value={val.id}>
                    {val.id}
                  </MenuItem>
                );
              })}
            </Select>
          </SelectField>
        </>
      )}
      <Button
        variant={"outlined"}
        onClick={download}
        disabled={!selectedAudio || !selectedVideo}
        className={Styles.input}
      >
        ダウンロード
      </Button>
    </div>
  );
};
export { Movie };
