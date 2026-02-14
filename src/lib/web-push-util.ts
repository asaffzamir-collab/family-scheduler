import webpush from "web-push";

// Configure VAPID keys
if (
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY &&
  process.env.VAPID_PRIVATE_KEY
) {
  webpush.setVapidDetails(
    "mailto:family-scheduler@example.com",
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;  // for notification grouping / dedup
}

/**
 * Send a push notification to a single subscription.
 */
export async function sendPush(
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
  payload: PushPayload
): Promise<boolean> {
  try {
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: subscription.keys,
      },
      JSON.stringify(payload)
    );
    return true;
  } catch (err: unknown) {
    const error = err as { statusCode?: number };
    console.error("[WebPush] Failed:", error);
    // 410 = subscription expired, should remove from DB
    if (error.statusCode === 410) {
      console.log("[WebPush] Subscription expired, should remove");
    }
    return false;
  }
}
