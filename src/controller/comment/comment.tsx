import { useSetAtom } from "jotai";
import type { FC } from "react";
import { useState } from "react";
import type { TCommentItemRemote } from "@/@types/queue";
import { isLoadingAtom } from "@/controller/atoms";
import { RemoteCommentPicker } from "@/controller/comment-picker/remote/remote-comment-picker";
import { runControllerTask } from "@/controller/task";

const Comment: FC = () => {
  const [key, setKey] = useState(0);
  const setIsLoading = useSetAtom(isLoadingAtom);
  const download = (comment?: TCommentItemRemote): void => {
    void runControllerTask(async () => {
      if (!comment) return;
      await window.api.request({
        type: "appendQueue",
        host: "controller",
        data: comment.ref,
      });
      setKey((pv) => pv + 1);
      setIsLoading(false);
    }, setIsLoading);
  };
  return <RemoteCommentPicker key={key} onChange={download} />;
};

export { Comment };
