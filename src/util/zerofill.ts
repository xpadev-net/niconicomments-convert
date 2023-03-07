const fill = (input: unknown, length: number, fill = "0") => {
  return `${fill.repeat(length)}${input}`.slice(length * -1);
};

export { fill };
