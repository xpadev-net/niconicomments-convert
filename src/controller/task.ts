import { getLogger } from "@/util/log";

const logger = getLogger("[controller]");

// Main reports IPC errors through the controller message channel. Observe the
// rejection here and release the UI even when a request fails partway through.
const runControllerTask = async (
  task: () => Promise<unknown>,
  setLoading?: (loading: boolean) => void,
): Promise<void> => {
  try {
    await task();
  } catch (error) {
    logger.error("Controller action failed", error);
  } finally {
    setLoading?.(false);
  }
};

export { runControllerTask };
