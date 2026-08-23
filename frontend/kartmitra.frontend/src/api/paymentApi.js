import { client } from "./client";

export const paymentApi = {
  /**
   * Submit a payment request.
   */
  createMockPayment(sessionId, amount) {
    return client.post("/payment/mock", { sessionId, amount });
  },
};
