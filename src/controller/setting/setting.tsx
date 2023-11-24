import type { FC } from "react";

import { AuthSetting } from "@/controller/setting/auth";
import { OtherSetting } from "@/controller/setting/other";

const Setting: FC = () => {
  return (
    <div>
      <AuthSetting />
      <OtherSetting />
    </div>
  );
};

export { Setting };
