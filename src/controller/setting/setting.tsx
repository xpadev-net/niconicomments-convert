import { ChangeEvent, useLayoutEffect, useState } from "react";
import {
  authByBrowserCookie,
  authByCookieFile,
  authType,
} from "@/@types/setting";
import {
  FormControlLabel,
  Radio,
  RadioGroup,
  TextField,
  Button,
} from "@mui/material";
import { Replay } from "@mui/icons-material";
import Styles from "./setting.module.scss";
import type { OpenDialogReturnValue } from "electron";

const Setting = () => {
  const [loading, setLoading] = useState(false);
  const [authSetting, setAuthSetting] = useState<Partial<authType>>();
  useLayoutEffect(() => {
    void (async () => {
      const data = (await window.api.request({
        type: "getSetting",
        key: "auth",
        host: "controller",
      })) as authType | undefined;
      setAuthSetting(data || { type: "browser", browser: "chrome" });
    })();
  }, [0]);

  const onAuthTypeChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (authSetting?.type === e.target.value) return;
    if (e.target.value === "cookie") {
      setAuthSetting({ type: "cookie", path: "" });
    } else if (e.target.value === "browser") {
      setAuthSetting({ type: "browser", browser: "chrome" });
    }
  };
  const onSelectCookieFile = () => {
    void (async () => {
      setLoading(true);
      const path = (await window.api.request({
        type: "selectFile",
        host: "controller",
        pattern: [
          {
            name: "cookie.txt",
            extensions: ["txt"],
          },
          {
            name: "All Files",
            extensions: ["*"],
          },
        ],
      })) as OpenDialogReturnValue;
      const cookiePath = path.filePaths[0];
      if (path.canceled || !cookiePath) {
        setLoading(false);
        return;
      }
      setAuthSetting({ ...authSetting, path: cookiePath } as authByCookieFile);
      setLoading(false);
    })();
  };
  const onAuthBrowserChange = (e: ChangeEvent<HTMLInputElement>) => {
    setAuthSetting({
      type: "browser",
      browser: e.target.value as "firefox" | "chrome",
    });
  };
  const onAuthBrowserProfileChange = (e: ChangeEvent<HTMLInputElement>) => {
    setAuthSetting({
      ...authSetting,
      profile: e.target.value,
    } as authByBrowserCookie);
  };
  const onReset = () => {
    void (async () => {
      setLoading(true);
      const data = (await window.api.request({
        type: "getSetting",
        key: "auth",
        host: "controller",
      })) as authType | undefined;
      setAuthSetting(data || { type: "browser", browser: "chrome" });
      setLoading(false);
    })();
  };
  const onSave = () => {
    void (async () => {
      setLoading(true);
      await window.api.request({
        type: "setSetting",
        key: "auth",
        data: authSetting,
        host: "controller",
      });
      setLoading(false);
    })();
  };
  if (!authSetting) return <></>;
  return (
    <div className={Styles.wrapper}>
      <div className={Styles.reset}>
        <Replay onClick={onReset} />
      </div>
      <h2>認証</h2>
      <RadioGroup value={authSetting.type} onChange={onAuthTypeChange} row>
        <FormControlLabel
          value={"cookie"}
          control={<Radio />}
          label={"Cookieファイル"}
        />
        <FormControlLabel
          value={"browser"}
          control={<Radio />}
          label={"ブラウザから取得"}
        />
      </RadioGroup>
      {authSetting.type === "cookie" && (
        <div>
          <Button variant={"outlined"} onClick={onSelectCookieFile}>
            Cookieファイルを選択
          </Button>
          <p>path: {authSetting.path}</p>
        </div>
      )}
      {authSetting.type === "browser" && (
        <div>
          <h3>ブラウザ</h3>
          <RadioGroup
            value={authSetting.browser}
            onChange={onAuthBrowserChange}
            row
          >
            <FormControlLabel
              value={"chrome"}
              control={<Radio />}
              label={"Chrome"}
            />
            <FormControlLabel
              value={"firefox"}
              control={<Radio />}
              label={"Firefox"}
            />
          </RadioGroup>
          <TextField
            label={"プロファイル名"}
            variant="standard"
            placeholder={"default"}
            value={authSetting.profile}
            onChange={onAuthBrowserProfileChange}
          />
        </div>
      )}
      <Button variant={"outlined"} onClick={onSave}>
        保存
      </Button>
      {loading && <div className={Styles.loading}>処理中...</div>}
    </div>
  );
};
export { Setting };
