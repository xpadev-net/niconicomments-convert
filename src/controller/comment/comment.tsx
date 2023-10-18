import { useSetAtom } from "jotai";
import type { FC } from "react";
import { useState } from "react";

import type { TCommentItemRemote } from "@/@types/queue";
import { isLoadingAtom } from "@/controller/atoms";
import { RemoteCommentPicker } from "@/controller/comment-picker/remote/remote-comment-picker";

const Comment: FC = () => {
  const [key, setKey] = useState(0);
  const setIsLoading = useSetAtom(isLoadingAtom);
  const download = (comment?: TCommentItemRemote): void => {
    void (async () => {
      if (!comment) return;
      setKey((pv) => ++pv);
      await window.api.request({
        type: "appendQueue",
        host: "controller",
        data: comment.ref,
      });
      setIsLoading(false);
    })();
  };
  return (
    <>
      <RemoteCommentPicker key={key} onChange={download} />
    </>
  );
};

export { Comment };
