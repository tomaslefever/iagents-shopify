const ENDPOINT = process.env.TOKEN_NOTIFY_URL;

export async function notifyTokenEvent(event, payload) {
  if (!ENDPOINT) {
    console.warn("[notify-token] TOKEN_NOTIFY_URL not set, skipping notification");
    return;
  }

  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event, ...payload }),
    });
    if (!res.ok) {
      console.error(
        `[notify-token] endpoint responded ${res.status} for ${event} ${payload.shop}`,
      );
    }
  } catch (err) {
    console.error(`[notify-token] failed to POST ${event} for ${payload.shop}:`, err);
  }
}
