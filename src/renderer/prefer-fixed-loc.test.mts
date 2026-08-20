import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  applyPreferFixedLocAt,
  comparePreferFixedLoc,
  limitCommentsForDraw,
  orderCommentsForDraw,
  type TimelineComment,
} from "./prefer-fixed-loc.mjs";

const comment = (
  loc: TimelineComment["loc"],
  owner: boolean,
  id: string,
): TimelineComment & { id: string } => ({ loc, owner, id });

describe("comparePreferFixedLoc", () => {
  it("places naka before ue and shita", () => {
    const comments = [
      comment("ue", false, "ue"),
      comment("naka", false, "naka"),
      comment("shita", false, "shita"),
    ];
    comments.sort(comparePreferFixedLoc);
    assert.deepEqual(
      comments.map((item) => item.id),
      ["naka", "ue", "shita"],
    );
  });

  it("places non-owner comments before owner comments at the same loc", () => {
    const comments = [
      comment("ue", true, "owner"),
      comment("ue", false, "user"),
    ];
    comments.sort(comparePreferFixedLoc);
    assert.deepEqual(
      comments.map((item) => item.id),
      ["user", "owner"],
    );
  });
});

describe("limitCommentsForDraw", () => {
  it("keeps the original subset when commentLimit is set", () => {
    const comments = [
      comment("naka", false, "n1"),
      comment("naka", false, "n2"),
      comment("ue", false, "u1"),
    ];
    assert.deepEqual(
      limitCommentsForDraw(comments, 2, "desc").map((item) => item.id),
      ["n1", "n2"],
    );
    assert.deepEqual(
      limitCommentsForDraw(comments, 2, "asc").map((item) => item.id),
      ["n2", "u1"],
    );
  });
});

describe("orderCommentsForDraw", () => {
  it("limits with the original order, then sorts only that subset", () => {
    const comments = [
      comment("ue", false, "u1"),
      comment("naka", false, "n1"),
      comment("naka", true, "n-owner"),
    ];
    assert.deepEqual(
      orderCommentsForDraw(comments, {
        commentLimit: 2,
        hideCommentOrder: "desc",
      }).map((item) => item.id),
      ["n1", "u1"],
    );
  });
});

describe("applyPreferFixedLocAt", () => {
  it("does not throw for a missing vpos", () => {
    assert.equal(applyPreferFixedLocAt(undefined, 0), undefined);
    assert.equal(applyPreferFixedLocAt({}, 1), undefined);
  });

  it("replaces the timeline slot and returns the original array", () => {
    const original = [comment("ue", false, "u1"), comment("naka", false, "n1")];
    const timeline: Record<number, TimelineComment[] | undefined> = {
      10: original,
    };
    const restored = applyPreferFixedLocAt(timeline, 10);
    assert.equal(restored, original);
    assert.deepEqual(
      timeline[10]?.map(
        (item) => (item as TimelineComment & { id: string }).id,
      ),
      ["n1", "u1"],
    );
  });
});
