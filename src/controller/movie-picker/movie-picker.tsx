import { Tab, Tabs } from "@mui/material";
import type { FC } from "react";
import { useState } from "react";

import type { TMovieItem } from "@/@types/queue";
import { LocalMoviePicker } from "@/controller/movie-picker/local";
import { RemoteMoviePicker } from "@/controller/movie-picker/remote";

type Props = {
  onChange: (val: TMovieItem | undefined) => void;
};

const MoviePicker: FC<Props> = ({ onChange }) => {
  const [tab, setTab] = useState(0);
  return (
    <section>
      <Tabs
        variant={"fullWidth"}
        value={tab}
        onChange={(_, value) => setTab(Number(value))}
      >
        <Tab label={"ファイルを選択"} value={0} />
        <Tab label={"動画をダウンロード"} value={1} />
      </Tabs>
      {tab === 0 && <LocalMoviePicker onChange={onChange} />}
      {tab === 1 && <RemoteMoviePicker onChange={onChange} />}
    </section>
  );
};

export { MoviePicker };
