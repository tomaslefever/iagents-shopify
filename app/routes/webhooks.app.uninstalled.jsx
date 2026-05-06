import { authenticate } from "../shopify.server";
import db from "../db.server";
import { notifyTokenEvent } from "../notify-token.server";

export const action = async ({ request }) => {
  const { shop, session, topic } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  await notifyTokenEvent("app/uninstalled", {
    shop,
    uninstalledAt: new Date().toISOString(),
  });

  if (session) {
    await db.session.deleteMany({ where: { shop } });
  }

  return new Response();
};
