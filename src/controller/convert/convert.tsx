import {
  Dialog,
  DialogContent,
  FormControl,
  FormControlLabel,
  FormGroup,
  InputLabel,
  MenuItem,
  Select,
  Switch,
} from "@mui/material";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import { useSetAtom } from "jotai";
import type { FC } from "react";
import { useEffect, useState } from "react";

import type { UUID } from "@/@types/brand";
import type { NiconicommentsOptions, Options } from "@/@types/options";
import type { TCommentItem, TMovieItem } from "@/@types/queue";
import type { ApiResponseType } from "@/@types/types";
import { isLoadingAtom, messageAtom } from "@/controller/atoms";
import { CommentPicker } from "@/controller/comment-picker";
import { MoviePicker } from "@/controller/movie-picker";
import { typeGuard } from "@/typeGuard";
import { str2time, time2str } from "@/util/time";
import { uuid } from "@/util/uuid";

import Styles from "./convert.module.scss";

const initialConfig: Options = {
  nico: {
    showCollision: {
      value: false,
      name: "当たり判定表示",
      type: "boolean",
    },
    showCommentCount: {
      value: false,
      name: "コメント描画数表示",
      type: "boolean",
    },
    keepCA: {
      value: false,
      name: "CA衝突抑制",
      type: "boolean",
    },
    scale: {
      value: 1,
      name: "スケール",
      type: "number",
    },
    mode: {
      value: "default",
      name: "変換モード",
      type: "string",
    },
  },
  video: {
    fps: 30,
  },
};

const Convert: FC = () => {
  const [movie, setMovie] = useState<TMovieItem | undefined>();
  const [comment, setComment] = useState<TCommentItem | undefined>();
  const [rawClip, setRawClip] = useState<{ start: string; end: string }>({
    start: "",
    end: "",
  });
  const [options, setOptions] = useState<Options>(initialConfig);
  const [modal, setModal] = useState<"movie" | "comment" | undefined>();
  const setIsLoading = useSetAtom(isLoadingAtom);
  const setMessage = useSetAtom(messageAtom);
  const onMovieClick = (): void => setModal("movie");
  const onCommentClick = (): void => setModal("comment");

  const onMovieChange = (val?: TMovieItem): void => {
    setMovie(val);
    setModal(undefined);
  };
  const onCommentChange = (val?: TCommentItem): void => {
    setComment(val);
    setModal(undefined);
  };

  const convert = (): void => {
    if (!comment || !movie) return;
    void (async () => {
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
      const nicoOption: { [key: string]: unknown } = {};
      for (const key in options.nico) {
        const item = options.nico[key as keyof NiconicommentsOptions];
        if (item.type === "number") {
          nicoOption[key] = Number(item.value);
        } else {
          nicoOption[key] = item.value;
        }
      }
      const wait: UUID[] = [];
      if (comment.type === "remote") wait.push(comment.ref.id);
      if (movie.type === "remote") wait.push(movie.ref.id);
      await window.api.request({
        type: "appendQueue",
        host: "controller",
        data: {
          type: "convert",
          id: uuid(),
          status: "queued",
          comment: comment,
          movie: movie,
          output: {
            path: output,
          },
          option: {
            ss: options.video.start,
            to: options.video.end,
            fps: options.video.fps,
            format: comment.format,
            options: {
              ...nicoOption,
            },
          },
          wait,
          progress: 0,
        },
      });
      setComment(undefined);
      setMovie(undefined);
      setIsLoading(false);
    })();
  };

  useEffect(() => {
    const eventHandler = (_: unknown, data: ApiResponseType): void => {
      if (data.target !== "controller") return;
      if (typeGuard.controller.message(data)) {
        setMessage({
          title: data.title || "未知のエラーが発生しました",
          content: data.message,
        });
      }
    };
    window.api.onResponse(eventHandler);
    return () => {
      window.api.remove(eventHandler);
    };
  }, []);
  return (
    <div className={Styles.wrapper}>
      <Button variant={"outlined"} onClick={onMovieClick}>
        動画を選択
      </Button>
      <Button variant={"outlined"} onClick={onCommentClick}>
        コメントを選択
      </Button>
      {movie && (
        <div>
          <h3>動画</h3>
          <p>path: {movie.path}</p>
          <p>duration: {movie.duration}</p>
          {movie.type === "remote" && (
            <>
              <p>source: {movie.ref.url}</p>
            </>
          )}
        </div>
      )}
      {comment && (
        <div>
          <h3>コメント</h3>
          <p>path: {comment.path}</p>
          <p>format: {comment.format}</p>
          {comment.type === "remote" && (
            <>
              <p>source: {comment.ref.url}</p>
            </>
          )}
        </div>
      )}
      {movie && comment && (
        <section>
          <div>
            <h3>切り抜き</h3>
            <TextField
              label="開始位置"
              placeholder={"--:--.--"}
              variant="standard"
              value={rawClip.start}
              onChange={(e) =>
                setRawClip({ ...rawClip, start: e.target.value })
              }
              onBlur={(e) => {
                const time = str2time(e.target.value);
                setOptions({
                  ...options,
                  video: { ...options.video, start: time },
                });
                setRawClip({ ...rawClip, start: time2str(time) });
              }}
            />
            <TextField
              label="終了位置"
              placeholder={"--:--.--"}
              variant="standard"
              value={rawClip.end}
              onChange={(e) => setRawClip({ ...rawClip, end: e.target.value })}
              onBlur={(e) => {
                const time = str2time(e.target.value);
                setOptions({
                  ...options,
                  video: { ...options.video, end: time },
                });
                setRawClip({ ...rawClip, end: time2str(time) });
              }}
            />
            <TextField
              label="FPS"
              variant="standard"
              type={"number"}
              value={options.video.fps}
              onChange={(e) =>
                setOptions({
                  ...options,
                  video: { ...options.video, fps: Number(e.target.value) },
                })
              }
            />
          </div>
          <FormGroup>
            <h3>設定</h3>
            {Object.keys(options.nico).map((key) => {
              const item = options.nico[key as keyof NiconicommentsOptions];
              if (item.type === "boolean") {
                return (
                  <FormControlLabel
                    key={key}
                    control={
                      <Switch
                        key={`${key}-switch`}
                        checked={item.value as boolean}
                        onChange={() =>
                          setOptions({
                            ...options,
                            nico: {
                              ...options.nico,
                              [key]: { ...item, value: !item.value },
                            },
                          })
                        }
                      />
                    }
                    label={item.name}
                  />
                );
              } else if (item.type === "string") {
                return (
                  <FormControl key={key} variant="standard">
                    <InputLabel>{item.name}</InputLabel>
                    <Select
                      value={item.value}
                      onChange={(e) =>
                        setOptions({
                          ...options,
                          nico: {
                            ...options.nico,
                            [key]: { ...item, value: e.target.value },
                          },
                        })
                      }
                    >
                      <MenuItem value={"default"}>自動</MenuItem>
                      <MenuItem value={"html5"}>HTML5互換</MenuItem>
                      <MenuItem value={"flash"}>Flash風</MenuItem>
                    </Select>
                  </FormControl>
                );
              }
              return (
                <TextField
                  key={key}
                  label={item.name}
                  variant="standard"
                  value={item.value}
                  type={"number"}
                  onChange={(e) =>
                    setOptions({
                      ...options,
                      nico: {
                        ...options.nico,
                        [key]: { ...item, value: e.target.value },
                      },
                    })
                  }
                />
              );
            })}
          </FormGroup>
          <div>
            <Button variant={"outlined"} onClick={convert}>
              変換
            </Button>
          </div>
        </section>
      )}
      <Dialog
        open={modal === "movie"}
        onClose={() => setModal(undefined)}
        fullWidth={true}
      >
        <DialogContent style={{ minHeight: "200px" }}>
          <MoviePicker onChange={onMovieChange} />
        </DialogContent>
      </Dialog>
      <Dialog
        open={modal === "comment"}
        onClose={() => setModal(undefined)}
        fullWidth={true}
      >
        <DialogContent style={{ minHeight: "200px" }}>
          <CommentPicker onChange={onCommentChange} />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export { Convert };
