export type winProtect = {
  encrypt: (input: Buffer) => Buffer;
  decrypt: (input: Buffer) => Buffer;
};
