export type Options = {
  nico: NiconicommentsOptions;
  video: VideoOptions;
};

type ModeType = "default" | "html5" | "flash";

export type NiconicommentsOptions = {
  showCollision: OptionItem<boolean>;
  showCommentCount: OptionItem<boolean>;
  keepCA: OptionItem<boolean>;
  scale: OptionItem<number>;
  mode: OptionItem<ModeType>;
};

export type VideoOptions = {
  fps: number;
  start?: number;
  end?: number;
};

type OptionItem<T> = {
  value: T;
  name: string;
  tips?: string;
  type: "number" | "string" | "boolean";
};
