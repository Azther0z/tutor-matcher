import { clearTimeout, setTimeout } from "node:timers";

// Best-effort delivery may continue after the response, but cannot delay it indefinitely.
export async function waitForBookingNotifications(notifications: Promise<unknown>[]) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      Promise.allSettled(notifications).then((results) => {
        for (const [index, result] of results.entries()) {
          if (result.status === "rejected") {
            // Do not log recipient data or raw errors that may contain private details.
            console.warn("[notification:booking] Notification failed", { recipientIndex: index });
          }
        }
      }),
      new Promise<void>((resolve) => {
        timer = setTimeout(resolve, 1000);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
