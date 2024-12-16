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
import { SelectField } from "@/components/select-field";
import { isLoadingAtom, messageAtom } from "@/controller/atoms";
import { CommentPicker } from "@/controller/comment-picker";
import { MoviePicker } from "@/controller/movie-picker";
import { typeGuard } from "@/type-guard";
import { str2time, time2str } from "@/util/time";
import { uuid } from "@/util/uuid";

import Styles from "./convert.module.scss";

const resolution = [
  { width: 1920, height: 1080, label: "1920x1080" },
  { width: 1280, height: 720, label: "1280x720" },
  { width: 1024, height: 576, label: "1024x576" },
  { width: 640, height: 360, label: "640x360" },
  { width: 320, height: 180, label: "320x180" },
] as const satisfies { width: number; height: number; label: string }[];

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
    width: 1920,
    height: 1080,
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
          filters: [
            {
              name: "Movies",
              extensions: [
                "mp4",
                "webm",
                "avi",
                "mkv",
                "wmv",
                "mov",
                "ts",
                "m2ts",
              ],
            },
          ],
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
            width: options.video.width,
            height: (options.video.width * 9) / 16,
            format: comment.format,
            options: {
              ...nicoOption,
            },
          },
          wait,
          progress: { percent: 0, total: 0, processed: 0 },
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
          title: data.title ?? "未知のエラーが発生しました",
          content: data.message,
        });
      }
    };
    window.api.onResponse(eventHandler);
    return () => {
      window.api.remove(eventHandler);
    };
  }, [setMessage]);
  return (
    <div className={Styles.wrapper}>
      <div>
        <h3>動画</h3>
        {movie ? (
          <div className={Styles.item}>
            <div className={Styles.metadata}>
              <p>path: {movie.path}</p>
              <p>duration: {movie.duration}</p>
              {movie.type === "remote" && (
                <p>
                  source: https://nico.ms/{movie.ref.url} (
                  {movie.ref.format.type})
                </p>
              )}
            </div>
            <Button variant={"outlined"} size={"small"} onClick={onMovieClick}>
              変更
            </Button>
          </div>
        ) : (
          <Button variant={"outlined"} onClick={onMovieClick}>
            動画を選択
          </Button>
        )}
      </div>
      <div>
        <h3>コメント</h3>
        {comment ? (
          <div className={Styles.item}>
            <div className={Styles.metadata}>
              <p>path: {comment.path}</p>
              <p>format: {comment.format}</p>
              {comment.type === "remote" && (
                <p>source: https://nico.ms/{comment.ref.url}</p>
              )}
            </div>
            <Button variant={"outlined"} onClick={onCommentClick}>
              変更
            </Button>
          </div>
        ) : (
          <Button variant={"outlined"} onClick={onCommentClick}>
            コメントを選択
          </Button>
        )}
      </div>
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
            <SelectField label={"解像度"} className={Styles.input}>
              <Select
                label={"解像度"}
                variant={"standard"}
                className={Styles.input}
                defaultValue={"1920x1080"}
                value={`${options.video.width}x${options.video.height}`}
                onChange={(e) => {
                  const [width, height] = e.target.value.split("x").map(Number);
                  setOptions({
                    ...options,
                    video: { ...options.video, width, height },
                  });
                }}
              >
                {resolution.map((val) => {
                  return (
                    <MenuItem key={val.label} value={val.label}>
                      {val.label}
                    </MenuItem>
                  );
                })}
              </Select>
            </SelectField>
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
              }
              if (item.type === "string") {
                return (
                  <FormControl key={key} variant="standard">
                    <InputLabel>{item.name}</InputLabel>
                    <Select
                      value={`${item.value}`}
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
