import { client } from "./client";

export const sessionApi = {
  /**
   * Start a new shopping session for a store.
   */
  startSession(storeId) {
    return client.post("/session/start", { storeId });
  },
};
