import { AddOutlined, DeleteOutlined } from "@mui/icons-material";
import { IconButton } from "@mui/material";
import TextField from "@mui/material/TextField";
import type { FC } from "react";
import { useLayoutEffect, useState } from "react";

import type { FfmpegOptions } from "@/@types/ffmpeg";

import { defaultOptions } from "../../../../electron/const";
import Styles from "./convert.module.scss";

const ConvertSetting: FC = () => {
  const [option, setOption] = useState<FfmpegOptions>();
  useLayoutEffect(() => {
    void (async () => {
      const value = ((await window.api.request({
        type: "getSetting",
        key: "ffmpegOptions",
        host: "controller",
      })) ?? defaultOptions) as FfmpegOptions;
      setOption(value);
    })();
  }, []);
  const update = (type: "key" | "value", key: string, value: string): void => {
    setOption((pv) => {
      if (type === "key") {
        const result = { ...pv };
        result[value] = result[key];
        delete result[key];
        void window.api.request({
          type: "setSetting",
          key: "ffmpegOptions",
          data: result,
          host: "controller",
        });
        return result;
      }
      const result = { ...pv, [key]: value };
      void window.api.request({
        type: "setSetting",
        key: "ffmpegOptions",
        data: result,
        host: "controller",
      });
      return result;
    });
  };
  const deleteItem = (key: string): void => {
    setOption((pv) => {
      const result = { ...pv };
      delete result[key];
      void window.api.request({
        type: "setSetting",
        key: "ffmpegOptions",
        data: result,
        host: "controller",
      });
      return result;
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
      <ul className={Styles.list}>
        <li>
          <span>[[FPS]]</span>: 変換時に指定するFPS
        </li>
        <li>
          <span>[[width]],[[height]]</span>: 変換時に指定する解像度
        </li>
      </ul>
      <div>
        {option &&
          Object.keys(option).map((key, index) => {
            return (
              <div key={index} className={Styles.block}>
                <TextField
                  label="key"
                  variant="standard"
                  value={key}
                  onChange={(e) => update("key", key, e.target.value)}
                  className={Styles.key}
                />
                <TextField
                  label="value"
                  variant="standard"
                  value={option[key]}
                  onChange={(e) => update("value", key, e.target.value)}
                  className={Styles.value}
                />
                <IconButton
                  className={Styles.delete}
                  onClick={() => deleteItem(key)}
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
