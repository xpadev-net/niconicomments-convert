import { Tab, Tabs } from "@mui/material";
import type { FC } from "react";
import { useState } from "react";

import type { TCommentItem } from "@/@types/queue";
import { LocalCommentPicker } from "@/controller/comment-picker/local";
import { RemoteCommentPicker } from "@/controller/comment-picker/remote";

type Props = {
  onChange: (val: TCommentItem | undefined) => void;
};

const CommentPicker: FC<Props> = ({ onChange }) => {
  const [tab, setTab] = useState(0);
  return (
    <section>
      <Tabs
        variant={"fullWidth"}
        value={tab}
        onChange={(_, value) => setTab(Number(value))}
      >
        <Tab label={"ファイルを選択"} value={0} />
        <Tab label={"コメントをダウンロード"} value={1} />
      </Tabs>
      {tab === 0 && <LocalCommentPicker onChange={onChange} />}
      {tab === 1 && <RemoteCommentPicker onChange={onChange} />}
    </section>
  );
};

export { CommentPicker };
