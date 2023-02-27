import { typeGuard } from "@/typeGuard";
import { str2time, time2str } from "@/util/time";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import { useCallback, useEffect, useState } from "react";
import {
  FormControl,
  FormControlLabel,
  FormGroup,
  InputLabel,
  MenuItem,
  Select,
  Switch,
} from "@mui/material";
import Styles from "./convert.module.scss";
import type { apiResponseType, Message, Movie } from "@/@types/types";
import type { niconicommentsOptions, Options } from "@/@types/options";
import { inputFormat, inputFormatType } from "@xpadev-net/niconicomments";
import { generateUuid } from "@/util/uuid";
import { useSetAtom } from "jotai";
import { isLoadingAtom, messageAtom } from "@/controller/atoms";

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

/*
const init = () => {
  document.body.innerHTML = `
<div id="info"></div>
<div id="movieInput">
  <button id="movie">動画を選択</button>
  <p id="movieMessage"></p>
</div>
<div id="commentInput">
  <button id="commentData">コメントデータを選択</button>
  <p id="commentMessage"></p>
</div>
<div id="startInput">
  <button id="start" class="disabled">変換開始</button>
</div>
<div id="progress" class="disabled">
  <div>
    generate:
    <span id="genProgress" class="progress"></span>
  </div>
  <div>
    convert:
    <span id="conProgress" class="progress"></span>
  </div>
</div>
<div id="options" class="disabled">
  <div>
    <label>
      <input type="text" name="clip-start" id="clip-start" autocomplete="off" value="" placeholder="--:--.--">
      開始位置
    </label>
    <label>
      <input type="text" name="clip-end" id="clip-end" autocomplete="off" value="" placeholder="--:--.--">
      終了位置
    </label>
    <p>0以下を設定すると先頭/末尾になります</p>
  </div>
  <div>
    <label>
      <input type="checkbox" name="show-collision" id="show-collision" autocomplete="off">
      当たり判定表示
    </label>
    <label>
      <input type="checkbox" name="show-comment-count" id="show-comment-count" autocomplete="off">
      コメント数表示
    </label>
    <label>
      <input type="checkbox" name="keep-ca" id="keep-ca" autocomplete="off">
      CA衝突回避
    </label>
    <label>
      コメントサイズ
      <input type="number" name="scale" id="scale" autocomplete="off" value="1" step="0.01">
    </label>
    <label>
      FPS
      <input type="number" name="scale" id="fps" autocomplete="off" value="30" step="1">
    </label>
  </div>
</div><style>
  #options label{
    display: inline-block;
  }
  #options label:hover{
    background-color: #ccc;
  }
  #progress > div{
    display: flex;
    flex-direction: row;
  }
  .progress{
    width: 100%;
    height: 20px;
    border: 1px black solid;
    display: inline-block;
    color: white;
  }
  .disabled{display: none}</style>`;
  let duration_ = 0,
    format: string | undefined = undefined,
    showCollision = false,
    showCommentCount = false,
    keepCA = false,
    totalFrames = 0,
    scale = 1,
    fps = 30,
    clipStart: number | undefined = undefined,
    clipEnd: number | undefined = undefined;
  const movieButton = document.getElementById("movie") as HTMLButtonElement,
    commentDataButton = document.getElementById(
      "commentData"
    ) as HTMLButtonElement,
    startButton = document.getElementById("start") as HTMLButtonElement,
    collisionInput = document.getElementById(
      "show-collision"
    ) as HTMLInputElement,
    commentCountInput = document.getElementById(
      "show-comment-count"
    ) as HTMLInputElement,
    keepCAInput = document.getElementById("keep-ca") as HTMLInputElement,
    scaleInput = document.getElementById("scale") as HTMLInputElement,
    fpsInput = document.getElementById("fps") as HTMLInputElement,
    clipStartInput = document.getElementById("clip-start") as HTMLInputElement,
    clipEndInput = document.getElementById("clip-end") as HTMLInputElement,
    movieMessage = document.getElementById("movieMessage"),
    commentMessage = document.getElementById("commentMessage"),
    progressWrapper = document.getElementById("progress"),
    genProgress = document.getElementById("genProgress"),
    conProgress = document.getElementById("conProgress"),
    options = document.getElementById("options"),
    info = document.getElementById("info");

  if (
    !(
      movieButton &&
      commentDataButton &&
      startButton &&
      collisionInput &&
      commentCountInput &&
      keepCAInput &&
      scaleInput &&
      clipStartInput &&
      clipEndInput &&
      movieMessage &&
      commentMessage &&
      progressWrapper &&
      genProgress &&
      conProgress &&
      options &&
      info
    )
  )
    throw new Error();

  movieButton.onclick = () => {
    window.api.request({
      type: "selectMovie",
      host: "controller",
    });
  };
  commentDataButton.onclick = () => {
    window.api.request({
      type: "selectComment",
      host: "controller",
    });
  };
  startButton.onclick = () => {
    window.api.request({
      type: "start",
      host: "controller",
      data: {
        showCollision,
        showCommentCount,
        keepCA,
        scale,
      },
      clipStart,
      clipEnd,
      fps,
    });
  };
  collisionInput.onchange = () => {
    showCollision = !showCollision;
    collisionInput.checked = showCollision;
  };
  commentCountInput.onchange = () => {
    showCommentCount = !showCommentCount;
    commentCountInput.checked = showCommentCount;
  };
  keepCAInput.onchange = () => {
    keepCA = !keepCA;
    keepCAInput.checked = keepCA;
  };
  scaleInput.onchange = () => {
    scale = Number(scaleInput.value);
  };
  fpsInput.onchange = () => {
    fps = Number(fpsInput.value);
  };
  clipStartInput.onchange = () => {
    const time = str2time(clipStartInput.value) || undefined;
    clipStart = time && clipEnd && time > clipEnd ? clipStart : time;
    clipStartInput.value = clipStart === undefined ? "" : time2str(clipStart);
  };
  clipEndInput.onchange = () => {
    const time = str2time(clipEndInput.value) || clipEnd;
    clipEnd =
      time && clipStart && time < clipStart
        ? clipEnd
        : time && time > duration_
        ? undefined
        : time;
    clipEndInput.value = clipEnd === undefined ? "" : time2str(clipEnd);
  };
  window.api.onResponse((data) => {
    if (data.target !== "controller") return;
    if (typeGuard.controller.selectMovie(data)) {
      if (data.message) {
        movieMessage.innerHTML = data.message;
        return;
      }
      const { path, width, height, duration } = data.data;
      movieMessage.innerText = `path:${path.filePaths}, width:${width}, height:${height}, duration:${duration}`;
      duration_ = duration;
      if (duration_ && format) {
        options.classList.toggle("disabled", false);
        startButton.classList.toggle("disabled", false);
      }
    } else if (typeGuard.controller.selectComment(data)) {
      format = data.format;
      commentMessage.innerText = `データ形式：${data.format}`;
      if (duration_ && format) {
        options.classList.toggle("disabled", false);
        startButton.classList.toggle("disabled", false);
      }
    } else if (typeGuard.controller.progress(data)) {
      progress(genProgress, data.generated, totalFrames);
      progress(conProgress, data.converted, totalFrames);
    } else if (typeGuard.controller.start(data)) {
      document.body.style.pointerEvents = "none";
      totalFrames = Math.ceil(
        ((clipEnd || duration_) - (clipStart || 0)) * fps
      );
      progressWrapper.classList.toggle("disabled", false);
    } else if (typeGuard.controller.end(data)) {
      document.body.style.pointerEvents = "unset";
      duration_ = 0;
      format = undefined;
      commentMessage.innerText = movieMessage.innerText = "";
      options.classList.toggle("disabled", true);
      startButton.classList.toggle("disabled", true);
      progressWrapper.classList.toggle("disabled", true);
      clipStart = clipEnd = undefined;
      clipStartInput.value = clipEndInput.value = "";
      alert("変換が完了しました");
    } else if (typeGuard.controller.message(data)) {
      info.innerHTML = data.message;
    }
  });
  const progress = (element: HTMLElement, current: number, max: number) => {
    element.innerText = `${Math.floor(
      (current / max) * 100
    )}% (${current}/${max})`;
    element.style.background = `linear-gradient(90deg,#006400 0%,#006400 ${
      (current / max) * 100
    }%,#000000 ${(current / max) * 100}%,#000000 100%)`;
  };
};*/
