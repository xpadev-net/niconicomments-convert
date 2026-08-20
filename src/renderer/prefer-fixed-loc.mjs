/**
 * @typedef {"ue" | "naka" | "shita"} CommentLoc
 * @typedef {"asc" | "desc"} HideCommentOrder
 * @typedef {{ loc: CommentLoc, owner: boolean }} TimelineComment
 * @typedef {{ commentLimit?: number, hideCommentOrder?: HideCommentOrder }} PreferFixedLocLimit
 */

/**
 * @param {CommentLoc} loc
 * @returns {number}
 */
const locRank = (loc) => (loc === "naka" ? 0 : 1);

/**
 * @param {TimelineComment} a
 * @param {TimelineComment} b
 * @returns {number}
 */
export const comparePreferFixedLoc = (a, b) => {
  const locDiff = locRank(a.loc) - locRank(b.loc);
  if (locDiff !== 0) return locDiff;
  return Number(a.owner) - Number(b.owner);
};

/**
 * @template T
 * @param {readonly T[]} comments
 * @param {number | undefined} commentLimit
 * @param {HideCommentOrder} [hideCommentOrder]
 * @returns {T[]}
 */
export const limitCommentsForDraw = (
  comments,
  commentLimit,
  hideCommentOrder = "asc",
) => {
  if (commentLimit === undefined) return [...comments];
  if (hideCommentOrder === "asc") return comments.slice(-commentLimit);
  return comments.slice(0, commentLimit);
};

/**
 * @template {TimelineComment} T
 * @param {readonly T[]} comments
 * @param {PreferFixedLocLimit} [limit]
 * @returns {T[]}
 */
export const orderCommentsForDraw = (comments, limit = {}) => {
  return limitCommentsForDraw(
    comments,
    limit.commentLimit,
    limit.hideCommentOrder,
  ).sort(comparePreferFixedLoc);
};

/**
 * @param {Record<number, TimelineComment[] | undefined> | undefined} timeline
 * @param {number} vpos
 * @param {PreferFixedLocLimit} [limit]
 * @returns {TimelineComment[] | undefined}
 */
export const applyPreferFixedLocAt = (timeline, vpos, limit = {}) => {
  const comments = timeline?.[vpos];
  if (!comments) return undefined;
  timeline[vpos] = orderCommentsForDraw(comments, limit);
  return comments;
};
