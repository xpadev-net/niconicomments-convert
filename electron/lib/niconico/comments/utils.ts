import type { FormattedComment, V1Thread } from "@xpadev-net/niconicomments";

export const convertV3ToFormatted = (
  input: V1Thread[],
  userList: string[],
): FormattedComment[] => {
  const comments = [];
  for (const thread of input) {
    const forkName = thread.fork;
    for (const comment of thread.comments) {
      const tmpParam: FormattedComment = {
        id: comment.no,
        vpos: Math.floor(comment.vposMs / 10),
        content: comment.body,
        date: date2time(comment.postedAt),
        date_usec: 0,
        owner: forkName === "owner",
        premium: comment.isPremium,
        mail: comment.commands,
        user_id: -1,
        layer: -1,
        is_my_post: false,
      };
      if (tmpParam.content.startsWith("/") && tmpParam.owner) {
        tmpParam.mail.push("invisible");
      }
      const isUserExist = userList.indexOf(comment.userId);
      if (isUserExist === -1) {
        tmpParam.user_id = userList.length;
        userList.push(comment.userId);
      } else {
        tmpParam.user_id = isUserExist;
      }
      comments.push(tmpParam);
    }
  }
  return comments;
};

/**
 * v1 apiのpostedAtはISO 8601のtimestampなのでDate関数を使ってunix timestampに変換
 * @param date {string} ISO 8601 timestamp
 * @return {number} unix timestamp
 */
const date2time = (date: string): number =>
  Math.floor(new Date(date).getTime() / 1000);
