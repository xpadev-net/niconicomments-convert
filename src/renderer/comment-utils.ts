import type { InputFormat, InputFormatType } from "@xpadev-net/niconicomments";

import type { CommentFormat } from "@/@types/niconicomments";
import type { V1Raw } from "@/@types/types";

const transformComments = (
  format: CommentFormat,
  input: string,
): {
  format: InputFormatType;
  data: InputFormat;
} => {
  if (format === "legacyOwner") {
    return {
      format: "legacyOwner",
      data: input,
    };
  }
  if (format === "XMLDocument" || format === "niconicome") {
    const parser = new DOMParser();
    return {
      format: "XMLDocument",
      data: parser.parseFromString(input, "application/xml"),
    };
  }
  const json = JSON.parse(input) as unknown;
  if (format === "rawV1") {
    return {
      format: "v1",
      data: (json as V1Raw).data.threads,
    };
  }
  return {
    format: format,
    data: json as InputFormat,
  };
};

export { transformComments };
