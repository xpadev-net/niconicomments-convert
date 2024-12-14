import { AddOutlined, DeleteOutlined, Replay } from "@mui/icons-material";
import { IconButton } from "@mui/material";
import TextField from "@mui/material/TextField";
import type { FC } from "react";
import { useLayoutEffect, useState } from "react";

import type { FfmpegOptions } from "@/@types/ffmpeg";

import { uuid } from "@/util/uuid";
import { defaultOptions } from "../../../../electron/const";
import Styles from "./convert.module.scss";

type OptionsValue = {
  id: string;
  key: string;
  value: string;
}[];

const rebuild = (value: OptionsValue): FfmpegOptions => {
  const result: FfmpegOptions = {};
  for (const v of value) {
    result[v.key] = v.value;
  }
  return result;
};

const ConvertSetting: FC = () => {
  const [option, setOption] = useState<OptionsValue>([]);
  useLayoutEffect(() => {
    void (async () => {
      const value = ((await window.api.request({
        type: "getSetting",
        key: "ffmpegOptions",
        host: "controller",
      })) ?? defaultOptions) as FfmpegOptions;
      setOption(
        Object.entries(value).map((value) => ({
          id: uuid(),
          key: value[0],
          value: value[1],
        })),
      );
    })();
  }, []);
  const update = (type: "key" | "value", id: string, value: string): void => {
    setOption((pv) => {
      const item = pv.find((v) => v.id === id);
      if (!item) return pv;
      if (type === "key") {
        item.key = value;
      } else {
        item.value = value;
      }
      void window.api.request({
        type: "setSetting",
        key: "ffmpegOptions",
        data: rebuild(pv),
        host: "controller",
      });
      return [...pv];
    });
  };
  const deleteItem = (id: string): void => {
    setOption((pv) => {
      const result = pv.filter((v) => v.id !== id);
      void window.api.request({
        type: "setSetting",
        key: "ffmpegOptions",
        data: rebuild(result),
        host: "controller",
      });
      return [...result];
    });
  };
  const onReset = (): void => {
    setOption(
      Object.entries(defaultOptions).map((v) => ({
        id: uuid(),
        key: v[0],
        value: v[1],
      })),
    );
    void window.api.request({
      type: "setSetting",
      key: "ffmpegOptions",
      data: defaultOptions,
      host: "controller",
    });
  };
  const addItem = (): void => {
    setOption((pv) => {
      const result = { ...pv, "": "" };
      void window.api.request({
        type: "setSetting",
        key: "ffmpegOptions",
        data: result,
        host: "controller",
      });
      return result;
    });
  };
  return (
    <div className={Styles.wrapper}>
      <h3>変換</h3>
      <div className={Styles.reset}>
        <IconButton onClick={onReset}>
          <Replay />
        </IconButton>
      </div>
      <ul className={Styles.list}>
        <li>
          <span>{"{FPS}"}</span>: 変換時に指定するFPS
        </li>
        <li>
          <span>{"{width}, {height}"}</span>: 変換時に指定する解像度
        </li>
      </ul>
      <div>
        {Object.entries(option).map(([index, { key, value, id }]) => {
          return (
            <div key={id} className={Styles.block}>
              <TextField
                label="key"
                variant="standard"
                value={key}
                onChange={(e) => update("key", id, e.target.value)}
                className={Styles.key}
              />
              <TextField
                label="value"
                variant="standard"
                value={value}
                onChange={(e) => update("value", id, e.target.value)}
                className={Styles.value}
              />
              <IconButton
                className={Styles.delete}
                onClick={() => deleteItem(id)}
              >
                <DeleteOutlined />
              </IconButton>
            </div>
          );
        })}
        <IconButton onClick={addItem}>
          <AddOutlined />
        </IconButton>
      </div>
    </div>
  );
};
export { ConvertSetting };
