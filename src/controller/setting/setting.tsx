import type { FC } from "react";

import { AuthSetting } from "@/controller/setting/auth";
import { ConvertSetting } from "@/controller/setting/convert";
import { OtherSetting } from "@/controller/setting/other";

import Styles from "./setting.module.scss";

const Setting: FC = () => {
  return (
    <div className={Styles.wrapper}>
      <AuthSetting />
      <ConvertSetting />
      <OtherSetting />
    </div>
  );
};

export { Setting };
