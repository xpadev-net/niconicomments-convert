import type { niconicommentsOptions, Options } from "@/@types/options";
import type { apiResponseType, Movie } from "@/@types/types";
import { isLoadingAtom, messageAtom } from "@/controller/atoms";
import { typeGuard } from "@/typeGuard";
import { str2time, time2str } from "@/util/time";
import { generateUuid } from "@/util/uuid";
import {
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
import { inputFormat, inputFormatType } from "@xpadev-net/niconicomments";
import { useSetAtom } from "jotai";
import { useCallback, useEffect, useState } from "react";
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

const Convert = () => {
  const [movie, setMovie] = useState<Movie | undefined>();
  const [comment, setComment] = useState<
    { format: inputFormatType; data: inputFormat } | undefined
  >();
  const [rawClip, setRawClip] = useState<{ start: string; end: string }>({
    start: "",
    end: "",
  });
  const [options, setOptions] = useState<Options>(initialConfig);
  const setIsLoading = useSetAtom(isLoadingAtom);
  const setMessage = useSetAtom(messageAtom);
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
  const onCommentClick = useCallback(() => {
    void (async () => {
      setIsLoading(true);
      const data = await window.api.request({
        type: "selectComment",
        host: "controller",
      });

      if (!typeGuard.controller.selectComment(data)) {
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
      setComment(data);
      setIsLoading(false);
    })();
  }, []);

  const convert = () => {
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
        const item = options.nico[key as keyof niconicommentsOptions];
        if (item.type === "number") {
          nicoOption[key] = Number(item.value);
        } else {
          nicoOption[key] = item.value;
        }
      }
      await window.api.request({
        type: "appendQueue",
        host: "controller",
        data: {
          type: "convert",
          id: generateUuid(),
          status: "queued",
          comment: {
            data: comment.data,
            options: {
              format: comment.format,
              ...nicoOption,
            },
          },
          movie: {
            path: movie.path.filePaths[0],
            duration: movie.duration,
            option: {
              ss: options.video.start,
              to: options.video.end,
            },
          },
          output: {
            path: output,
            fps: options.video.fps,
          },
          progress: {
            generated: 0,
            converted: 0,
            total:
              Math.ceil(
                (options.video.end || movie.duration) -
                  (options.video.start || 0)
              ) * options.video.fps,
          },
        },
      });
      setComment(undefined);
      setMovie(undefined);
      setIsLoading(false);
    })();
  };

  useEffect(() => {
    const eventHandler = (_: unknown, data: apiResponseType) => {
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
      <div>
        <Button variant={"outlined"} onClick={onMovieClick}>
          動画を選択
        </Button>
        {typeof movie === "object" && (
          <p>
            path:{movie.path.filePaths}, width:{movie.width}, height:
            {movie.height}, duration:{movie.duration}
          </p>
        )}
      </div>
      <div>
        <Button variant={"outlined"} onClick={onCommentClick}>
          コメントデータを選択
        </Button>
        {comment && <p>フォーマット：{comment.format}</p>}
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
            {Object.keys(options.nico).map((key) => {
              const item = options.nico[key as keyof niconicommentsOptions];
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
    </div>
  );
};

export { Convert };
