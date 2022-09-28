const typeGuard = {
  main: {
    selectMovie: (i: unknown): i is apiRequestSelectMovie =>
      typeof i === "object" &&
      (i as apiRequestSelectMovie).type === "selectMovie",
    selectComment: (i: unknown): i is apiRequestSelectComment =>
      typeof i === "object" &&
      (i as apiRequestSelectComment).type === "selectComment",
    start: (i: unknown): i is apiRequestStart =>
      typeof i === "object" && (i as apiRequestStart).type === "start",
  },
  render: {
    progress: (i: unknown): i is apiRequestProgress =>
      typeof i === "object" && (i as apiRequestProgress).type === "progress",
    buffer: (i: unknown): i is apiRequestBuffer =>
      typeof i === "object" && (i as apiRequestBuffer).type === "buffer",
    end: (i: unknown): i is apiRequestEnd =>
      typeof i === "object" && (i as apiRequestEnd).type === "end",
    load: (i: unknown): i is apiRequestLoad =>
      typeof i === "object" && (i as apiRequestLoad).type === "load",
  },
};
export { typeGuard };
