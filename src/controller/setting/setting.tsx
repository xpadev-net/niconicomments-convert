import type { FC } from "react";

import { AuthSetting } from "@/controller/setting/auth";

const Setting: FC = () => {
  return (
    <div>
      <AuthSetting />
    </div>
  );
};

export { Setting };
