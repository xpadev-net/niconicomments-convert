import { ChangeEvent, useLayoutEffect, useState } from "react";
import { authByCookieFile, authType } from "@/@types/setting";
import {
  FormControlLabel,
  Radio,
  RadioGroup,
  Button,
  Select,
  MenuItem,
} from "@mui/material";
import { Replay } from "@mui/icons-material";
import Styles from "./setting.module.scss";
import type { OpenDialogReturnValue } from "electron";
import { useSetAtom } from "jotai";
import { isLoadingAtom } from "@/controller/atoms";
import { browserProfile } from "@/@types/cookies";
import { SelectField } from "@/components/SelectField";

const Setting = () => {
  const setIsLoading = useSetAtom(isLoadingAtom);
  const [authSetting, setAuthSetting] = useState<Partial<authType>>();
  const [availableProfiles, setAvailableProfiles] = useState<browserProfile[]>(
    []
  );
  useLayoutEffect(() => {
    void (async () => {
      const data = (await window.api.request({
        type: "getSetting",
        key: "auth",
        host: "controller",
      })) as authType | undefined;
      setAuthSetting(data || { type: "noAuth" });
      const profiles = (await window.api.request({
        type: "getAvailableProfiles",
        host: "controller",
      })) as browserProfile[];
      setAvailableProfiles(profiles);
    })();
  }, [0]);

  const onAuthTypeChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (authSetting?.type === e.target.value) return;
    if (e.target.value === "cookie") {
      setAuthSetting({ type: "cookie", path: "" });
    } else if (e.target.value === "browser") {
      setAuthSetting({ type: "browser", profile: undefined });
    } else if (e.target.value === "noAuth") {
      setAuthSetting({ type: "noAuth" });
    }
  };
  const onSelectCookieFile = () => {
    void (async () => {
      setIsLoading(true);
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
        setIsLoading(false);
        return;
      }
      setAuthSetting({ ...authSetting, path: cookiePath } as authByCookieFile);
      setIsLoading(false);
    })();
  };
  const onAuthBrowserChange = (name: string) => {
    setAuthSetting({
      type: "browser",
      profile: availableProfiles.reduce<browserProfile | undefined>(
        (pv, val) => (`${val.browser}:${val.name}` === name ? val : pv),
        undefined
      ),
    });
  };
  const onReset = () => {
    void (async () => {
      setIsLoading(true);
      const data = (await window.api.request({
        type: "getSetting",
        key: "auth",
        host: "controller",
      })) as authType | undefined;
      setAuthSetting(data || { type: "noAuth" });
      setIsLoading(false);
    })();
  };
  const onSave = () => {
    void (async () => {
      setIsLoading(true);
      await window.api.request({
        type: "setSetting",
        key: "auth",
        data: authSetting,
        host: "controller",
      });
      setIsLoading(false);
    })();
  };
  console.log(availableProfiles);
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
          disabled={true}
        />
        <FormControlLabel
          value={"browser"}
          control={<Radio />}
          label={"ブラウザから取得"}
        />
        <FormControlLabel
          value={"noAuth"}
          control={<Radio />}
          label={"認証なし"}
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
        <SelectField label={"ブラウザ"} className={Styles.input}>
          <Select
            label={"ブラウザ"}
            variant={"standard"}
            className={Styles.input}
            value={
              authSetting.profile
                ? `${authSetting.profile.browser}:${authSetting.profile.name}`
                : ""
            }
            onChange={(e) => onAuthBrowserChange(e.target.value)}
          >
            <MenuItem disabled value="">
              <em>認証に使用するブラウザを選択してください</em>
            </MenuItem>
            {availableProfiles.map((val) => {
              return (
                <MenuItem
                  key={`${val.browser}:${val.name}`}
                  value={`${val.browser}:${val.name}`}
                >
                  {val.browser} ({val.name})
                </MenuItem>
              );
            })}
          </Select>
        </SelectField>
      )}
      <Button variant={"outlined"} onClick={onSave}>
        保存
      </Button>
    </div>
  );
};
export { Setting };
