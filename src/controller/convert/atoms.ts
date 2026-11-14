import { atom } from "jotai";

import type { Options } from "@/@types/options";
import type { TCommentItem, TMovieItem } from "@/@types/queue";

const initialConfig: Options = {
  nico: {
    showCollision: {
      value: false,
      name: "当たり判定表示",
      type: "boolean",
    },
    showCommentCount: {
      value: false,
      name: "コメント描画数表示",
      type: "boolean",
    },
    keepCA: {
      value: false,
      name: "CA衝突抑制",
      type: "boolean",
    },
    scale: {
      value: 1,
      name: "スケール",
      type: "number",
    },
    mode: {
      value: "default",
      name: "変換モード",
      type: "string",
    },
  },
  video: {
    fps: 30,
    width: 1920,
    height: 1080,
  },
};

// Keep the conversion draft when the tab's component is unmounted.
const movieAtom = atom<TMovieItem | undefined>(undefined);
const commentAtom = atom<TCommentItem | undefined>(undefined);
const rawClipAtom = atom({ start: "", end: "" });
const optionsAtom = atom<Options>(initialConfig);

export { commentAtom, movieAtom, optionsAtom, rawClipAtom };
