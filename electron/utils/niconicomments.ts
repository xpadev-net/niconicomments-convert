import * as fs from "node:fs";
import NiconiComments from "@xpadev-net/niconicomments";
import { parseStringPromise } from "@xpadev-net/xml2js";

import type { CommentFormat } from "@/@types/niconicomments";
import type { V1Raw } from "@/@types/types";

const identifyCommentFormat = async (
  input: string,
): Promise<CommentFormat | undefined> => {
  const fileData = fs.readFileSync(input, "utf8");
  if (input.match(/\.xml$/)) {
    const json = (await parseStringPromise(fileData, {
      includeWhiteChars: true,
    })) as unknown;
    if (NiconiComments.typeGuard.xml2js.packet(json)) {
      return "xml2js";
    }
    return;
  }
  if (input.match(/\.json$/) || input.match(/_commentJSON\.txt$/)) {
    const json = JSON.parse(fileData) as unknown;
    if (
      (json as V1Raw)?.meta?.status === 200 &&
      NiconiComments.typeGuard.v1.threads((json as V1Raw)?.data?.threads)
    ) {
      return "rawV1";
    }
    if (NiconiComments.typeGuard.v1.threads(json)) {
      return "v1";
    }
    if (NiconiComments.typeGuard.legacy.rawApiResponses(json)) {
      return "legacy";
    }
    if (NiconiComments.typeGuard.owner.comments(json)) {
      return "owner";
    }
    if (
      NiconiComments.typeGuard.formatted.comments(json) ||
      NiconiComments.typeGuard.formatted.legacyComments(json)
    ) {
      return "formatted";
    }
    return;
  }
  if (input.match(/\.txt$/)) {
    return "legacyOwner";
  }
};

export { identifyCommentFormat };
