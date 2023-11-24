import Button from "@mui/material/Button";
import { useSetAtom } from "jotai";
import type { FC } from "react";
import { useCallback, useState } from "react";

import type { TCommentItemLocal } from "@/@types/queue";
import { isLoadingAtom, messageAtom } from "@/controller/atoms";
import Styles from "@/controller/comment-picker/remote/remote-comment-picker.module.scss";
import { typeGuard } from "@/type-guard";

type Props = {
  onChange: (val: TCommentItemLocal | undefined) => void;
};

const LocalCommentPicker: FC<Props> = ({ onChange }) => {
  const [comment, setComment] = useState<TCommentItemLocal | undefined>();
  const setIsLoading = useSetAtom(isLoadingAtom);
  const setMessage = useSetAtom(messageAtom);
  const onCommentClick = useCallback(() => {
    void (async () => {
      setIsLoading(true);
      const data = await window.api.request({
        type: "selectComment",
        host: "controller",
      });

      if (!typeGuard.controller.selectComment(data)) {
        setIsLoading(false);
        if (typeGuard.controller.message(data)) {
          setMessage({
            title: data.title || "未知のエラーが発生しました",
            content: data.message,
          });
          return;
        }
        if (!data) return;
        throw new Error();
      }
      setComment({
        ...data,
        type: "local",
      });
      setIsLoading(false);
    })();
  }, []);

  const onClick = (): void => {
    onChange(comment);
  };

  return (
    <div>
      <Button variant={"outlined"} onClick={onCommentClick}>
        コメントデータを選択
      </Button>
      {comment && (
        <>
          <table>
            <tbody>
              <tr>
                <th>format</th>
                <td>{comment.format}</td>
              </tr>
            </tbody>
          </table>
          <Button
            variant={"outlined"}
            onClick={onClick}
            disabled={!comment}
            className={Styles.input}
          >
            確定
          </Button>
        </>
      )}
    </div>
  );
};
export { LocalCommentPicker };
