import { FormControlLabel, Switch } from "@mui/material";
import type { FC } from "react";
import { useLayoutEffect, useState } from "react";
import { runControllerTask } from "@/controller/task";

const OtherSetting: FC = () => {
  const [showRendererWindow, setShowRendererWindow] = useState<boolean>(false);
  useLayoutEffect(() => {
    void runControllerTask(async () => {
      const value =
        (await window.api.request({
          type: "getSetting",
          key: "showRendererWindow",
          host: "controller",
        })) ?? true;
      setShowRendererWindow(!!value);
    });
  }, []);
  return (
    <div>
      <h3>その他</h3>
      <FormControlLabel
        control={
          <Switch
            checked={showRendererWindow}
            onChange={() => {
              setShowRendererWindow((pv) => {
                void runControllerTask(() =>
                  window.api.request({
                    type: "setSetting",
                    key: "showRendererWindow",
                    data: !pv,
                    host: "controller",
                  }),
                );
                return !pv;
              });
            }}
          />
        }
        label={"書き出し時にレンダラウィンドウを表示する"}
      />
    </div>
  );
};

export { OtherSetting };
