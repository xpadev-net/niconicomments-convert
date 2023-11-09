import { MenuItem, Select } from "@mui/material";
import type { FC } from "react";
import { useEffect, useState } from "react";

import type { TWatchV3Metadata } from "@/@types/niconico";
import type { TDomandFormat } from "@/@types/queue";
import { SelectField } from "@/components/SelectField";
import Styles from "@/controller/movie/movie.module.scss";
import { getDomandBestSegment } from "@/util/niconico";

type Props = {
  metadata: TWatchV3Metadata<"domand">;
  onChange: (val: TDomandFormat | undefined) => void;
};

const DomandMoviePicker: FC<Props> = ({ metadata, onChange }) => {
  const [selectedVideo, setSelectedVideo] = useState<string>("");
  const [selectedAudio, setSelectedAudio] = useState<string>("");
  useEffect(() => {
    setSelectedAudio(
      getDomandBestSegment(metadata.data.media.domand.audios).id,
    );
    setSelectedVideo(
      getDomandBestSegment(metadata.data.media.domand.videos).id,
    );
  }, [metadata]);

  useEffect(() => {
    onChange({
      type: "domand",
      format: [selectedVideo, selectedAudio],
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
            getDomandBestSegment(metadata.data.media.domand.videos).id
          }
          className={Styles.input}
          onChange={(e) => setSelectedVideo(e.target.value)}
        >
          {metadata.data.media.domand.videos.map((val) => {
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
            getDomandBestSegment(metadata.data.media.domand.audios).id
          }
          value={selectedAudio}
          onChange={(e) => setSelectedAudio(e.target.value)}
        >
          {metadata.data.media.domand.audios.map((val) => {
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

export { DomandMoviePicker };
