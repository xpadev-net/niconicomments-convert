type CommentLoc = "ue" | "naka" | "shita";

export type TimelineComment = {
  loc: CommentLoc;
  owner: boolean;
};

const locRank = (loc: CommentLoc): number => (loc === "naka" ? 0 : 1);

const comparePreferFixedLoc = (
  a: TimelineComment,
  b: TimelineComment,
): number => {
  const locDiff = locRank(a.loc) - locRank(b.loc);
  if (locDiff !== 0) return locDiff;
  return Number(a.owner) - Number(b.owner);
};

export const applyPreferFixedLocAt = (
  timeline: Record<number, TimelineComment[] | undefined> | undefined,
  vpos: number,
): void => {
  timeline?.[vpos]?.sort(comparePreferFixedLoc);
};
