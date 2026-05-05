import { authenticate } from "../../shopify.server";
import { registerWebhook } from "../../shopify.server";

export async function action({ request }) {
  const { topic, shop, body } = await authenticate.webhook(request);

  console.log(`[Webhook] ${topic} from ${shop}`);
  console.log(`[Webhook] Body:`, body);

  switch (topic) {
    case "checkouts/create":
      return handleCheckoutCreate(shop, body);
    default:
      return new Response(`Unhandled webhook topic: ${topic}`, { status: 404 });
  }
}

function handleCheckoutCreate(shop, body) {
  const checkout = body;
  console.log("Checkout creado:", {
   shop,
    checkoutId: checkout.id,
    email: checkout.email,
    totalPrice: checkout.totalPrice,
    lineItemsCount: checkout.lineItems?.length,
  });

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}