export type HideCommentOrder = "asc" | "desc";

export type TimelineComment = {
  loc: "ue" | "naka" | "shita";
  owner: boolean;
};

export type PreferFixedLocLimit = {
  commentLimit?: number;
  hideCommentOrder?: HideCommentOrder;
};

export declare const comparePreferFixedLoc: (
  a: TimelineComment,
  b: TimelineComment,
) => number;

export declare const limitCommentsForDraw: <T>(
  comments: readonly T[],
  commentLimit?: number,
  hideCommentOrder?: HideCommentOrder,
) => T[];

export declare const orderCommentsForDraw: <T extends TimelineComment>(
  comments: readonly T[],
  limit?: PreferFixedLocLimit,
) => T[];

export declare const applyPreferFixedLocAt: (
  timeline: Record<number, TimelineComment[] | undefined> | undefined,
  vpos: number,
  limit?: PreferFixedLocLimit,
) => TimelineComment[] | undefined;
