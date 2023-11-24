import { FormControlLabel, Switch } from "@mui/material";
import type { FC } from "react";
import { useLayoutEffect, useState } from "react";

const OtherSetting: FC = () => {
  const [showRendererWindow, setShowRendererWindow] = useState<boolean>(false);
  useLayoutEffect(() => {
    void (async () => {
      const value =
        (await window.api.request({
          type: "getSetting",
          key: "showRendererWindow",
          host: "controller",
        })) ?? true;
      setShowRendererWindow(!!value);
    })();
  }, []);
  return (
    <div>
      <FormControlLabel
        control={
          <Switch
            checked={showRendererWindow}
            onChange={() => {
              setShowRendererWindow((pv) => {
                void window.api.request({
                  type: "setSetting",
                  key: "showRendererWindow",
                  data: !pv,
                  host: "controller",
                });
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
