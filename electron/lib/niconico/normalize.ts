import type {
  V3MetadataBody,
  V3MetadataCommentThread,
  WatchPageV4Response,
  WatchV4Data,
} from "@/@types/niconico.js";

const isWatchV4Response = (i: unknown): i is WatchPageV4Response =>
  typeof i === "object" &&
  i !== null &&
  typeof (i as WatchPageV4Response).$watchV4?.data === "object";

/**
 * 新仕様 ($watchV4) の視聴ページ情報を、アプリ内部で扱う V3MetadataBody 形式へ変換する
 * 新仕様ではDMCが廃止されDMS(domand)のみになっている
 */
const normalizeWatchV4 = (data: WatchV4Data): V3MetadataBody => {
  const { video, comment, media, viewer } = data;
  return {
    comment: {
      server: { url: comment.nvComment.server },
      keys: { userKey: "" },
      nvComment: comment.nvComment,
      threads: comment.threads.map(
        (thread): V3MetadataCommentThread => ({
          id: thread.id,
          fork: thread.fork,
          forkLabel: thread.forkLabel,
          videoId: thread.videoId,
          isActive: true,
          isDefaultPostTarget: thread.isPostTarget,
          isEasyCommentPostTarget: false,
          isLeafRequired: false,
          isOwnerThread: thread.isOwnerThread,
          isThreadkeyRequired: false,
          threadkey: null,
          is184Forces: thread.is184Forced,
          hasNicoscript: false,
          label: thread.label,
          postkeyStatus: 0,
          server: comment.nvComment.server,
        }),
      ),
    },
    media: {
      delivery: null,
      domand: media
        ? {
            videos: media.contents.videos,
            audios: media.contents.audios,
            accessRightKey: media.accessRightKey,
          }
        : null,
    },
    video: {
      id: video.id,
      title: video.title,
      description: video.description,
      count: video.count,
      duration: video.duration,
      thumbnail: {
        url: video.thumbnail.normal,
        middleUrl: video.thumbnail.middle ?? video.thumbnail.normal,
        largeUrl: video.thumbnail.large ?? video.thumbnail.normal,
        player: video.thumbnail.player,
        ogp: video.thumbnail.ogp,
      },
      rating: { isAdult: video.permission.rating.isAdult },
      registeredAt: video.registeredAt,
      isPrivate: video.permission.isPrivate,
      isDeleted: video.permission.isDeleted,
      isNoBanner: false,
      isAuthenticationRequired: video.permission.isAuthenticationRequired,
      isEmbedPlayerAllowed: video.permission.isEmbedPlayerAllowed,
      viewer: null,
      watchableUserTypeForPayment: data.payment?.watchableUserType ?? "",
      commentableUserTypeForPayment: data.payment?.commentableUserType ?? "",
      "9d091f87": false,
    },
    viewer: viewer ? { ...viewer } : null,
    client: { watchTrackId: data.client.watchTrackId },
  };
};

const normalizeWatchResponse = (
  response: V3MetadataBody | WatchPageV4Response,
): V3MetadataBody =>
  isWatchV4Response(response)
    ? normalizeWatchV4(response.$watchV4.data)
    : response;

export { normalizeWatchResponse };
