import type { availableNicovideoApi } from "@/@types/niconico";
import { SelectField } from "@/components/SelectField";
import { MetaCe } from "@/controller/comment/MetaCe";
import { MetaV3 } from "@/controller/comment/MetaV3";
import Styles from "@/controller/setting/setting.module.scss";
import { MenuItem, Select } from "@mui/material";
import { useState } from "react";

const availableApis: availableNicovideoApi[] = ["v3+legacy", "v3+v1"];

const Comment = () => {
  const [api, setApi] = useState<availableNicovideoApi>("v3+v1");

  return (
    <>
      <SelectField label={"コメントAPI"}>
        <Select
          label={"コメントAPI"}
          variant={"standard"}
          className={Styles.input}
          value={api}
          onChange={(e) => setApi(e.target.value as availableNicovideoApi)}
        >
          <MenuItem disabled value="">
            コメント取得に使用するAPIを選択してください
          </MenuItem>
          {availableApis.map((api) => {
            return (
              <MenuItem key={api} value={api}>
                {api}
              </MenuItem>
            );
          })}
        </Select>
      </SelectField>
      {api.match(/v3/) && <MetaV3 api={api} />}
      {api.match(/ce/) && <MetaCe api={api} />}
    </>
  );
};

export { Comment };
