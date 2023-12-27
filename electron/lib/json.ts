const encodeJson = (input: unknown): string => {
  return JSON.stringify(input, null, "\t");
};

const encodeError = (input: unknown): string => {
  return JSON.stringify(input, Object.getOwnPropertyNames(input), "\t");
};

export { encodeError, encodeJson };
