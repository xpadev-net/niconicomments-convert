import * as fs from "node:fs";
import niconicomments from "@xpadev-net/niconicomments";
import { parseStringPromise } from "@xpadev-net/xml2js";

import type { CommentFormat } from "@/@types/niconicomments.js";
import type { V1Raw } from "@/@types/types.js";

const identifyCommentFormat = async (
  input: string,
): Promise<CommentFormat | undefined> => {
  const fileData = fs.readFileSync(input, "utf8");
  if (input.match(/\.xml$/)) {
    const json = (await parseStringPromise(fileData, {
      includeWhiteChars: true,
    })) as unknown;
    if (niconicomments.default.typeGuard.xml2js.packet(json)) {
      return "xml2js";
    }
    return;
  }
  if (input.match(/\.json$/) || input.match(/_commentJSON\.txt$/)) {
    const json = JSON.parse(fileData) as unknown;
    if (
      (json as V1Raw)?.meta?.status === 200 &&
      niconicomments.default.typeGuard.v1.threads(
        (json as V1Raw)?.data?.threads,
      )
    ) {
      return "rawV1";
    }
    if (niconicomments.default.typeGuard.v1.threads(json)) {
      return "v1";
    }
    if (niconicomments.default.typeGuard.legacy.rawApiResponses(json)) {
      return "legacy";
    }
    if (niconicomments.default.typeGuard.owner.comments(json)) {
      return "owner";
    }
    if (
      niconicomments.default.typeGuard.formatted.comments(json) ||
      niconicomments.default.typeGuard.formatted.legacyComments(json)
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
