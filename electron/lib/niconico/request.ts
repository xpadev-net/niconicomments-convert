// Keep the deadline active until the response body has also been consumed.
const withRequestTimeout = async <T>(
  signal: AbortSignal | undefined,
  request: (signal: AbortSignal) => Promise<T>,
  timeoutMs = 30_000,
): Promise<T> => {
  const controller = new AbortController();
  const requestSignal = signal
    ? AbortSignal.any([signal, controller.signal])
    : controller.signal;
  requestSignal.throwIfAborted();
  const timer = setTimeout(() => {
    controller.abort(new DOMException("Request timed out", "TimeoutError"));
  }, timeoutMs);
  try {
    return await request(requestSignal);
  } finally {
    clearTimeout(timer);
  }
};

export { withRequestTimeout };
