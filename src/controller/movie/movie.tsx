import { useSetAtom } from "jotai";
import type { FC } from "react";
import { useState } from "react";

import type { TMovieItemRemote } from "@/@types/queue";
import { isLoadingAtom } from "@/controller/atoms";
import { RemoteMoviePicker } from "@/controller/movie-picker/remote/remote-movie-picker";

import Styles from "./movie.module.scss";

const Movie: FC = () => {
  const [key, setKey] = useState(0);
  const setIsLoading = useSetAtom(isLoadingAtom);
  const download = (movie?: TMovieItemRemote): void => {
    void (async () => {
      if (!movie) return;
      setKey((pv) => ++pv);
      await window.api.request({
        type: "appendQueue",
        host: "controller",
        data: movie.ref,
      });
      setIsLoading(false);
    })();
  };
  return (
    <div className={Styles.wrapper}>
      <RemoteMoviePicker key={key} onChange={download} />
    </div>
  );
};
export { Movie };
