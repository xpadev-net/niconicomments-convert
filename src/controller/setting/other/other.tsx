import { FormControlLabel, Switch } from "@mui/material";
import type { FC } from "react";
import { useLayoutEffect, useState } from "react";

import { getSetting } from "@/util/settings";

const OtherSetting: FC = () => {
  const [showRendererWindow, setShowRendererWindow] = useState<boolean>(false);
  useLayoutEffect(() => {
    void (async () => {
      setShowRendererWindow(await getSetting("showRendererWindow"));
    })();
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
