type apiResponseToRenderer = {
  target: "renderer";
};
type apiResponseStartRender = {
  type: "start";
  data: inputFormats;
  format: inputFormatTypes;
  options: Options;
  duration: number;
  fps: number;
  offset: number;
  frames: number;
};
type apiResponsesToRenderer =
  | apiResponseEnd
  | apiResponseProgress
  | apiResponseStartRender;
