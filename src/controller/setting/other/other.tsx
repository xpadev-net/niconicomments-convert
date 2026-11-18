import { FormControlLabel, Switch } from "@mui/material";
import type { FC } from "react";
import { useLayoutEffect, useState } from "react";
import { runControllerTask } from "@/controller/task";

import { getSetting } from "@/util/settings";

const OtherSetting: FC = () => {
  const [showRendererWindow, setShowRendererWindow] = useState<boolean>(false);
  const [autoUpdate, setAutoUpdate] = useState<boolean>(false);
  useLayoutEffect(() => {
    void runControllerTask(async () => {
      setShowRendererWindow(await getSetting("showRendererWindow"));
      setAutoUpdate((await getSetting("autoUpdate")) === "enabled");
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
      <FormControlLabel
        control={
          <Switch
            checked={autoUpdate}
            onChange={(_, checked) => {
              setAutoUpdate(checked);
              void runControllerTask(() =>
                window.api.request({
                  type: "setSetting",
                  key: "autoUpdate",
                  data: checked ? "enabled" : "disabled",
                  host: "controller",
                }),
              );
            }}
          />
        }
        label={"起動時に更新を確認して自動でダウンロードする"}
      />
    </div>
  );
};

export { OtherSetting };
