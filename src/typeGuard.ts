const typeGuard = {
  controller: {
    selectMovie: (i: unknown): i is apiResponseSelectMovie =>
      typeof i === "object" &&
      (i as apiResponseSelectMovie).type === "selectMovie",
    selectComment: (i: unknown): i is apiResponseSelectComment =>
      typeof i === "object" &&
      (i as apiResponseSelectComment).type === "selectComment",
    progress: (i: unknown): i is apiResponseProgress =>
      typeof i === "object" && (i as apiResponseProgress).type === "progress",
    start: (i: unknown): i is apiResponseStartMain =>
      typeof i === "object" && (i as apiResponseStartMain).type === "start",
    end: (i: unknown): i is apiResponseEndMain =>
      typeof i === "object" && (i as apiResponseEndMain).type === "end",
    message: (i: unknown): i is apiResponse =>
      typeof i === "object" && (i as apiResponse).type === "message",
  },
  renderer: {
    start: (i: unknown): i is apiResponseStartRender =>
      typeof i === "object" && (i as apiResponseStartRender).type === "start",
    progress: (i: unknown): i is apiResponseProgressRender =>
      typeof i === "object" &&
      (i as apiResponseProgressRender).type === "progress",
    end: (i: unknown): i is apiResponseEndRender =>
      typeof i === "object" && (i as apiResponseEndRender).type === "end",
  },
};

export { typeGuard };
