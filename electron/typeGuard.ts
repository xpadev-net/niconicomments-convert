const typeGuard = {
  main: {
    selectMovie: (i: unknown): i is apiRequestSelectMovie =>
      typeof i === "object" &&
      (i as apiRequestSelectMovie).type === "selectMovie",
    selectComment: (i: unknown): i is apiRequestSelectComment =>
      typeof i === "object" &&
      (i as apiRequestSelectComment).type === "selectComment",
    start: (i: unknown): i is apiRequestStart =>
      typeof i === "object" && (i as apiRequestStart).type === "start",
  },
  render: {
    progress: (i: unknown): i is apiRequestProgress =>
      typeof i === "object" && (i as apiRequestProgress).type === "progress",
    buffer: (i: unknown): i is apiRequestBuffer =>
      typeof i === "object" && (i as apiRequestBuffer).type === "buffer",
    end: (i: unknown): i is apiRequestEnd =>
      typeof i === "object" && (i as apiRequestEnd).type === "end",
    load: (i: unknown): i is apiRequestLoad =>
      typeof i === "object" && (i as apiRequestLoad).type === "load",
  },
  formatted: {
    comment: (i: unknown): i is formattedComment =>
      objectVerify(i, [
        "id",
        "vpos",
        "content",
        "date",
        "date_usec",
        "owner",
        "premium",
        "mail",
        "user_id",
        "layer",
      ]),
    comments: (i: unknown): i is formattedComment[] => {
      if (typeof i !== "object") return false;
      for (const item of i as formattedComment[]) {
        if (!typeGuard.formatted.comment(item)) return false;
      }
      return true;
    },
    legacyComment: (i: unknown): i is formattedLegacyComment =>
      objectVerify(i, [
        "id",
        "vpos",
        "content",
        "date",
        "owner",
        "premium",
        "mail",
      ]),
    legacyComments: (i: unknown): i is formattedLegacyComment[] => {
      if (typeof i !== "object") return false;
      for (const item of i as formattedLegacyComment[]) {
        if (!typeGuard.formatted.legacyComment(item)) return false;
      }
      return true;
    },
  },
  legacy: {
    rawApiResponses: (i: unknown): i is rawApiResponse[] => {
      if (typeof i !== "object") return false;
      for (const itemWrapper of i as rawApiResponse[]) {
        for (const key of Object.keys(itemWrapper)) {
          const item = itemWrapper[key];
          if (!item) continue;
          if (
            !(
              typeGuard.legacy.apiChat(item) ||
              typeGuard.legacy.apiGlobalNumRes(item) ||
              typeGuard.legacy.apiLeaf(item) ||
              typeGuard.legacy.apiPing(item) ||
              typeGuard.legacy.apiThread(item)
            )
          ) {
            return false;
          }
        }
      }
      return true;
    },
    apiChat: (i: unknown): i is apiChat =>
      typeof i === "object" &&
      objectVerify(i as apiChat, ["content", "date", "no", "thread", "vpos"]),
    apiGlobalNumRes: (i: unknown): i is apiGlobalNumRes =>
      objectVerify(i, ["num_res", "thread"]),
    apiLeaf: (i: unknown): i is apiLeaf => objectVerify(i, ["count", "thread"]),
    apiPing: (i: unknown): i is apiPing => objectVerify(i, ["content"]),
    apiThread: (i: unknown): i is apiThread =>
      objectVerify(i, [
        "resultcode",
        "revision",
        "server_time",
        "thread",
        "ticket",
      ]),
  },
  niconicome: {
    xmlDocument: (i: unknown): i is XMLDocument => {
      if (
        !(i as XMLDocument).documentElement ||
        (i as XMLDocument).documentElement.nodeName !== "packet"
      )
        return false;
      if (!(i as XMLDocument).documentElement.children) return false;
      for (
        let index = 0;
        index < (i as XMLDocument).documentElement.children.length;
        index++
      ) {
        const value = (i as XMLDocument).documentElement.children[index];
        if (!value) continue;
        if (index === 0) {
          if (
            value.nodeName !== "thread" ||
            !typeAttributeVerify(value, [
              "resultcode",
              "thread",
              "server_time",
              "last_res",
              "revision",
            ])
          )
            return false;
        } else {
          if (
            value.nodeName !== "chat" ||
            !typeAttributeVerify(value, [
              "thread",
              "no",
              "vpos",
              "date",
              "date_usec",
              "anonymity",
              "user_id",
              "mail",
              "leaf",
              "premium",
              "score",
            ])
          )
            return false;
        }
      }
      return true;
    },
  },
  legacyOwner: {
    comments: (i: unknown): i is string => {
      if (typeof i !== "string") return false;
      const lists = i.split("\n");
      for (const list of lists) {
        if (list.split(":").length < 3) {
          return false;
        }
      }
      return true;
    },
  },
  owner: {
    comment: (i: unknown): i is ownerComment =>
      objectVerify(i, ["time", "command", "comment"]),
    comments: (i: unknown): i is ownerComment[] => {
      if (typeof i !== "object") return false;
      for (const item of i as ownerComment[]) {
        if (!typeGuard.owner.comment(item)) return false;
      }
      return true;
    },
  },
  v1: {
    comment: (i: unknown): i is apiThread =>
      objectVerify(i, [
        "id",
        "no",
        "vposMs",
        "body",
        "commands",
        "userId",
        "isPremium",
        "score",
        "postedAt",
        "nicoruCount",
        "nicoruId",
        "source",
        "isMyPost",
      ]),
    thread: (i: unknown): i is v1Thread => {
      if (!objectVerify(i, ["id", "fork", "commentCount", "comments"]))
        return false;
      for (const item of Object.keys((i as v1Thread).comments)) {
        if (!typeGuard.v1.comment((i as v1Thread).comments[item])) return false;
      }
      return true;
    },
    threads: (i: unknown): i is v1Thread[] => {
      if (typeof i !== "object") return false;
      for (const item of i as v1Thread[]) {
        if (!typeGuard.v1.thread(item)) return false;
      }
      return true;
    },
  },
};
const objectVerify = (item: unknown, keys: string[]): boolean => {
  if (typeof item !== "object" || !item) return false;
  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(item, key)) return false;
  }
  return true;
};
const typeAttributeVerify = (item: unknown, keys: string[]): boolean => {
  if (typeof item !== "object" || !item) return false;
  for (const key of keys) {
    if ((item as Element).getAttribute(key) === null) return false;
  }
  return true;
};
export { typeGuard };
