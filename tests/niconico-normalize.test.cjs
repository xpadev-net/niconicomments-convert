const assert = require("node:assert/strict");
const { test } = require("node:test");
const {
  normalizeWatchResponse,
} = require("../build/electron/lib/niconico/normalize");

const v4 = {
  $watchV4: {
    data: {
      client: { watchTrackId: "track_1" },
      comment: {
        threads: [
          {
            id: 1,
            fork: 0,
            forkLabel: "main",
            videoId: "sm9",
            isPostTarget: true,
            isOwnerThread: false,
            is184Forced: false,
            label: "default",
          },
        ],
        nvComment: {
          threadKey: "key",
          server: "https://public.nvcomment.nicovideo.jp",
          params: { targets: [{ id: "1", fork: "main" }], language: "ja-jp" },
        },
      },
      media: {
        contents: { videos: [{ id: "v" }], audios: [{ id: "a" }] },
        accessRightKey: "ark",
      },
      video: {
        id: "sm9",
        title: "t",
        description: "d",
        count: { view: 1, comment: 2, mylist: 3, like: 4 },
        duration: 10,
        thumbnail: {
          normal: "n",
          middle: null,
          large: null,
          player: "p",
          ogp: "o",
        },
        registeredAt: "2007-03-06T00:33:00+09:00",
        permission: {
          isPrivate: false,
          isDeleted: false,
          isAuthenticationRequired: false,
          isEmbedPlayerAllowed: true,
          rating: { isAdult: false },
        },
      },
      viewer: null,
    },
  },
};

test("normalizes the $watchV4 response into the internal metadata shape", () => {
  const result = normalizeWatchResponse(v4);
  assert.equal(result.media.delivery, null);
  assert.equal(result.media.domand.accessRightKey, "ark");
  assert.equal(result.client.watchTrackId, "track_1");
  assert.equal(result.comment.threads[0].forkLabel, "main");
  assert.equal(result.video.thumbnail.largeUrl, "n");
  assert.equal(result.viewer, null);
});

test("passes the legacy response through unchanged", () => {
  const legacy = { media: { delivery: null, domand: null } };
  assert.equal(normalizeWatchResponse(legacy), legacy);
});
