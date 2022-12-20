export type Options = {
  nico: niconicommentsOptions;
  video: videoOptions;
};

type modeType = "default" | "html5" | "flash";

export type niconicommentsOptions = {
  showCollision: optionItem<boolean>;
  showCommentCount: optionItem<boolean>;
  keepCA: optionItem<boolean>;
  scale: optionItem<number>;
  mode: optionItem<modeType>;
};

export type videoOptions = {
  fps: number;
  start?: number;
  end?: number;
};

type optionItem<T> = {
  value: T;
  name: string;
  tips?: string;
  type: "number" | "string" | "boolean";
};
