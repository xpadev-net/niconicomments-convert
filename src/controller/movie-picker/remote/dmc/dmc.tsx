import { MenuItem, Select } from "@mui/material";
import type { FC } from "react";
import { useEffect, useState } from "react";

import type { TWatchV3Metadata } from "@/@types/niconico";
import type { TDMCFormat } from "@/@types/queue";
import { SelectField } from "@/components/SelectField";
import Styles from "@/controller/movie/movie.module.scss";
import { getDMCBestSegment } from "@/util/niconico";

type Props = {
  metadata: TWatchV3Metadata<"dmc">;
  onChange: (val: TDMCFormat | undefined) => void;
};

const DMCMoviePicker: FC<Props> = ({ metadata, onChange }) => {
  const [selectedVideo, setSelectedVideo] = useState<string>("");
  const [selectedAudio, setSelectedAudio] = useState<string>("");
  useEffect(() => {
    setSelectedAudio(
      getDMCBestSegment(metadata.data.media.delivery.movie.audios).id,
    );
    setSelectedVideo(
      getDMCBestSegment(metadata.data.media.delivery.movie.videos).id,
    );
  }, [metadata]);
  useEffect(() => {
    onChange({
      type: "dmc",
      format: {
        video: selectedVideo,
        audio: selectedAudio,
      },
    });
  }, [selectedAudio, selectedVideo]);
  return (
    <>
      <SelectField label={"動画"} className={Styles.input}>
        <Select
          label={"動画"}
          variant={"standard"}
          value={selectedVideo}
          defaultValue={
            getDMCBestSegment(metadata.data.media.delivery.movie.videos).id
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
            getDMCBestSegment(metadata.data.media.delivery.movie.audios).id
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
    </>
  );
};

export { DMCMoviePicker };
