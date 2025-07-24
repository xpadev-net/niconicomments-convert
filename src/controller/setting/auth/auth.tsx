import { Replay } from "@mui/icons-material";
import {
  Button,
  FormControlLabel,
  IconButton,
  MenuItem,
  Radio,
  RadioGroup,
  Select,
} from "@mui/material";
import type { OpenDialogReturnValue } from "electron";
import { useSetAtom } from "jotai";
import type { ChangeEvent, FC } from "react";
import { useLayoutEffect, useState } from "react";

import type { BrowserProfile } from "@/@types/cookies";
import type { UserData } from "@/@types/niconico";
import type { AuthByCookieFile, AuthType } from "@/@types/setting";
import { SelectField } from "@/components/select-field";
import { isLoadingAtom } from "@/controller/atoms";

import Styles from "./auth.module.scss";

const AuthSetting: FC = () => {
  const setIsLoading = useSetAtom(isLoadingAtom);
  const [authSetting, setAuthSetting] = useState<Partial<AuthType>>();
  const [availableProfiles, setAvailableProfiles] = useState<
    { profile: BrowserProfile; user: UserData; key: string }[]
  >([]);
  useLayoutEffect(() => {
    void (async () => {
      const data = (await window.api.request({
        type: "getSetting",
        key: "auth",
        host: "controller",
      })) as AuthType | undefined;
      setAuthSetting(data ?? { type: "NoAuth" });
      const profiles = (await window.api.request({
        type: "getAvailableProfiles",
        host: "controller",
      })) as { profile: BrowserProfile; user: UserData }[];
      setAvailableProfiles(
        profiles.map((item) => {
          return {
            ...item,
            key: `${item.user.data.nickname}#${item.user.data.userId} (${item.profile.browser}:${item.profile.name})`,
          };
        }),
      );
    })();
  }, []);

  const onAuthTypeChange = (e: ChangeEvent<HTMLInputElement>): void => {
    if (authSetting?.type === e.target.value) return;
    if (e.target.value === "cookie") {
      setAuthSetting({ type: "cookie", path: "" });
    } else if (e.target.value === "browser") {
      setAuthSetting({ type: "browser", profile: undefined });
    } else if (e.target.value === "NoAuth") {
      setAuthSetting({ type: "NoAuth" });
    }
  };
  const onSelectCookieFile = (): void => {
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
      setAuthSetting({ ...authSetting, path: cookiePath } as AuthByCookieFile);
      setIsLoading(false);
    })();
  };
  const onAuthBrowserChange = (name: string): void => {
    setAuthSetting({
      type: "browser",
      profile: availableProfiles.reduce<BrowserProfile | undefined>(
        (pv, val) =>
          `${val.profile.browser}:${val.profile.name}` === name
            ? val.profile
            : pv,
        undefined,
      ),
    });
  };
  const onReset = (): void => {
    void (async () => {
      setIsLoading(true);
      const data = (await window.api.request({
        type: "getSetting",
        key: "auth",
        host: "controller",
      })) as AuthType | undefined;
      setAuthSetting(data ?? { type: "NoAuth" });
      setIsLoading(false);
    })();
  };
  const onSave = (): void => {
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

  if (!authSetting) return null;
  return (
    <div className={Styles.wrapper}>
      <div className={Styles.reset}>
        <IconButton onClick={onReset}>
          <Replay />
        </IconButton>
      </div>
      <h3>認証</h3>
      <RadioGroup value={authSetting.type} onChange={onAuthTypeChange} row>
        <FormControlLabel
          value={"cookie"}
          control={<Radio />}
          label={"Cookieファイル"}
        />
        <FormControlLabel
          value={"browser"}
          control={<Radio />}
          disabled={availableProfiles.length < 1}
          label={"ブラウザから取得"}
        />
        <FormControlLabel
          value={"NoAuth"}
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
                  key={`${val.profile.browser}:${val.profile.name}`}
                  value={`${val.profile.browser}:${val.profile.name}`}
                >
                  {val.key}
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
export { AuthSetting };
