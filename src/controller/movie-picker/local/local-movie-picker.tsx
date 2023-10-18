import Button from "@mui/material/Button";
import { useSetAtom } from "jotai";
import type { FC } from "react";
import { useCallback, useState } from "react";

import type { TMovieItemLocal } from "@/@types/queue";
import type { Movie } from "@/@types/types";
import { isLoadingAtom, messageAtom } from "@/controller/atoms";
import { typeGuard } from "@/typeGuard";

type Props = {
  onChange: (val: TMovieItemLocal | undefined) => void;
};

const LocalMoviePicker: FC<Props> = ({ onChange }) => {
  const setIsLoading = useSetAtom(isLoadingAtom);
  const setMessage = useSetAtom(messageAtom);
  const [movie, setMovie] = useState<Movie | undefined>();
  const onMovieClick = useCallback(() => {
    void (async () => {
      setIsLoading(true);
      const data = await window.api.request({
        type: "selectMovie",
        host: "controller",
      });
      if (!typeGuard.controller.selectMovie(data)) {
        setIsLoading(false);
        if (typeGuard.controller.message(data)) {
          setMessage({
            title: data.title || "未知のエラーが発生しました",
            content: data.message,
          });
          return;
        }
        if (!data) return;
        throw new Error();
      }
      setMovie(data.data);
      setIsLoading(false);
    })();
  }, []);
  const onClick = (): void => {
    if (!movie) return;
    onChange({
      type: "local",
      duration: movie.duration,
      path: movie.path.filePaths[0],
    });
  };
  return (
    <div>
      <Button variant={"outlined"} onClick={onMovieClick}>
        動画を選択
      </Button>
      {typeof movie === "object" && (
        <>
          <table>
            <tbody>
              <tr>
                <th>path</th>
                <td>{movie.path.filePaths[0]}</td>
              </tr>
              <tr>
                <th>width</th>
                <td>{movie.width}</td>
              </tr>
              <tr>
                <th>height</th>
                <td>{movie.height}</td>
              </tr>
              <tr>
                <th>duration</th>
                <td>{movie.duration}</td>
              </tr>
            </tbody>
          </table>
          <Button variant={"outlined"} onClick={onClick} disabled={!movie}>
            確定
          </Button>
        </>
      )}
    </div>
  );
};

export { LocalMoviePicker };
