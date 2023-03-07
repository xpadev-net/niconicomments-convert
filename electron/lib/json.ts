const encodeJson = (input: unknown): string => {
  return JSON.stringify(input, null, "\t");
};
export { encodeJson };
