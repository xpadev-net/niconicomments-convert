type apiResponseToRenderer = {
  target: "renderer";
};
type apiResponseStartRender = {
  type: "start";
  data: inputFormats;
  format: inputFormatTypes;
  options: options;
  duration: number;
  fps: number;
  offset: number;
};
type apiResponsesToRenderer =
  | apiResponseEnd
  | apiResponseProgress
  | apiResponseStartRender;
