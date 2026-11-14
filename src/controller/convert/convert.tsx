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
import { useAtom, useSetAtom } from "jotai";
import type { FC, DragEvent as ReactDragEvent } from "react";
import { useCallback, useEffect, useRef, useState } from "react";

import type { UUID } from "@/@types/brand";
import type { NiconicommentsOptions } from "@/@types/options";
import type { TCommentItem, TMovieItem } from "@/@types/queue";
import { SelectField } from "@/components/select-field";
import { isLoadingAtom, messageAtom } from "@/controller/atoms";
import { CommentPicker } from "@/controller/comment-picker";
import { MoviePicker } from "@/controller/movie-picker";
import { getConversionError } from "@/domain/conversion";
import { typeGuard } from "@/type-guard";
import { str2time, time2str } from "@/util/time";
import { uuid } from "@/util/uuid";

import { commentAtom, movieAtom, optionsAtom, rawClipAtom } from "./atoms";
import Styles from "./convert.module.scss";

const resolution = [
  { width: 1920, height: 1080, label: "1920x1080" },
  { width: 1280, height: 720, label: "1280x720" },
  { width: 1024, height: 576, label: "1024x576" },
  { width: 640, height: 360, label: "640x360" },
  { width: 320, height: 180, label: "320x180" },
] as const satisfies { width: number; height: number; label: string }[];

const Convert: FC = () => {
  const [movie, setMovie] = useAtom(movieAtom);
  const [comment, setComment] = useAtom(commentAtom);
  const [rawClip, setRawClip] = useAtom(rawClipAtom);
  const [options, setOptions] = useAtom(optionsAtom);
  const [modal, setModal] = useState<"movie" | "comment" | undefined>();
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);
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

  const handleDropRequest = useCallback(
    async (paths: string[]) => {
      if (!paths.length) return;
      setIsLoading(true);
      try {
        const data = await window.api.request({
          host: "controller",
          type: "dropFiles",
          paths,
        });
        if (typeGuard.controller.dropFiles(data)) {
          if (data.movie) {
            setMovie({
              type: "local",
              duration: data.movie.duration,
              path: data.movie.path.filePaths[0],
            });
          }
          if (data.comment) {
            setComment({
              type: "local",
              path: data.comment.path,
              format: data.comment.format,
            });
          }
        } else if (typeGuard.controller.message(data)) {
          setMessage({
            title: data.title ?? "未知のエラーが発生しました",
            content: data.message,
          });
        }
      } finally {
        setIsLoading(false);
      }
    },
    [setComment, setIsLoading, setMessage, setMovie],
  );

  const isFileDragEvent = useCallback(
    (event: DragEvent | ReactDragEvent<HTMLElement>): boolean => {
      const types = event.dataTransfer?.types;
      return types ? Array.from(types).includes("Files") : false;
    },
    [],
  );

  useEffect(() => {
    const onWindowDragEnter = (event: DragEvent) => {
      if (!isFileDragEvent(event)) return;
      event.preventDefault();
      dragCounter.current += 1;
      setIsDragging(true);
    };
    const onWindowDragOver = (event: DragEvent) => {
      if (!isFileDragEvent(event)) return;
      event.preventDefault();
      if (!event.dataTransfer) return;
      event.dataTransfer.dropEffect = "copy";
    };
    const onWindowDragLeave = (event: DragEvent) => {
      if (!isFileDragEvent(event)) return;
      event.preventDefault();
      dragCounter.current = Math.max(0, dragCounter.current - 1);
      if (dragCounter.current === 0) {
        setIsDragging(false);
      }
    };
    const onWindowDrop = (event: DragEvent) => {
      if (!isFileDragEvent(event)) return;
      event.preventDefault();
      dragCounter.current = 0;
      setIsDragging(false);
      const files = Array.from(event.dataTransfer?.files ?? []);
      const paths = Array.from(
        new Set(
          files
            .map((file) => window.api.getPathForFile(file))
            .filter((filePath): filePath is string => !!filePath),
        ),
      );
      void handleDropRequest(paths);
    };

    window.addEventListener("dragenter", onWindowDragEnter);
    window.addEventListener("dragover", onWindowDragOver);
    window.addEventListener("dragleave", onWindowDragLeave);
    window.addEventListener("drop", onWindowDrop);

    return () => {
      window.removeEventListener("dragenter", onWindowDragEnter);
      window.removeEventListener("dragover", onWindowDragOver);
      window.removeEventListener("dragleave", onWindowDragLeave);
      window.removeEventListener("drop", onWindowDrop);
    };
  }, [handleDropRequest, isFileDragEvent]);

  const convert = (): void => {
    if (!comment || !movie) return;
    const start = rawClip.start.trim();
    const end = rawClip.end.trim();
    const nicoOption: { [key: string]: unknown } = {};
    for (const key in options.nico) {
      const item = options.nico[key as keyof NiconicommentsOptions];
      nicoOption[key] =
        item.type === "number" ? Number(item.value) : item.value;
    }
    const option = {
      ss: start ? str2time(start) : undefined,
      to: end ? str2time(end) : undefined,
      fps: options.video.fps,
      width: options.video.width,
      height: options.video.height,
      format: comment.format,
      options: nicoOption,
    };
    const error =
      (start && option.ss === undefined) || (end && option.to === undefined)
        ? "開始位置・終了位置は秒数または分:秒の形式で指定してください。"
        : getConversionError(option, movie.duration);
    if (error) {
      setMessage({ title: "入力内容を確認してください", content: error });
      return;
    }
    void (async () => {
      setIsLoading(true);
      try {
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
        if (typeof output !== "string") return;
        const wait: UUID[] = [];
        if (comment.type === "remote") wait.push(comment.ref.id);
        if (movie.type === "remote") wait.push(movie.ref.id);
        const accepted = await window.api.request({
          type: "appendQueue",
          host: "controller",
          data: {
            type: "convert",
            id: uuid(),
            status: "queued",
            comment,
            movie,
            output: { path: output },
            option,
            wait,
            progress: { percent: 0, total: 0, processed: 0 },
          },
        });
        if (accepted === true) {
          setComment(undefined);
          setMovie(undefined);
        }
      } catch (error) {
        setMessage({
          title: "変換の登録に失敗しました",
          content: error instanceof Error ? error.message : String(error),
        });
      } finally {
        setIsLoading(false);
      }
    })();
  };

  return (
    <div className={Styles.wrapper}>
      {isDragging && (
        <div className={Styles.dropOverlay}>
          <p>動画とコメントをここにドロップ</p>
          <p>個別ドロップにも対応しています</p>
        </div>
      )}
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
                if (time !== undefined)
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
                if (time !== undefined)
                  setRawClip({ ...rawClip, end: time2str(time) });
              }}
            />
            <TextField
              label="FPS"
              variant="standard"
              type={"number"}
              value={Number.isNaN(options.video.fps) ? "" : options.video.fps}
              error={
                !Number.isFinite(options.video.fps) || options.video.fps <= 0
              }
              helperText={
                !Number.isFinite(options.video.fps) || options.video.fps <= 0
                  ? "0より大きい有限の数値を指定してください"
                  : undefined
              }
              onChange={(e) =>
                setOptions({
                  ...options,
                  video: {
                    ...options.video,
                    fps:
                      e.target.value === ""
                        ? Number.NaN
                        : Number(e.target.value),
                  },
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
