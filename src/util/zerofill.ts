const fill = (input: unknown, length: number, fill = "0"): string => {
  return `${fill.repeat(length)}${input}`.slice(length * -1);
};

export { fill };
