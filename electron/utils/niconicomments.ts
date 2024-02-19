import NiconiComments from "@xpadev-net/niconicomments";
import * as fs from "fs";
import { parseStringPromise } from "xml2js";

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
    } else {
      return;
    }
  } else if (input.match(/\.json$/) || input.match(/_commentJSON\.txt$/)) {
    const json = JSON.parse(fileData) as unknown;
    if (
      (json as V1Raw)?.meta?.status === 200 &&
      NiconiComments.typeGuard.v1.threads((json as V1Raw)?.data?.threads)
    ) {
      return "rawV1";
    } else if (NiconiComments.typeGuard.v1.threads(json)) {
      return "v1";
    } else if (NiconiComments.typeGuard.legacy.rawApiResponses(json)) {
      return "legacy";
    } else if (NiconiComments.typeGuard.owner.comments(json)) {
      return "owner";
    } else if (
      NiconiComments.typeGuard.formatted.comments(json) ||
      NiconiComments.typeGuard.formatted.legacyComments(json)
    ) {
      return "formatted";
    } else {
      return;
    }
  } else if (input.match(/\.txt$/)) {
    return "legacyOwner";
  }
};

export { identifyCommentFormat };
