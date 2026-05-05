import { authenticate } from "../../shopify.server";

export async function action({ request }) {
  const { topic, shop, body } = await authenticate.webhook(request);

  console.log(`[Webhook] ${topic} from ${shop}`);

  switch (topic) {
    case "checkouts/update":
      return handleCheckoutUpdate(shop, body);
    default:
      return new Response(`Unhandled webhook topic: ${topic}`, { status: 404 });
  }
}

function handleCheckoutUpdate(shop, body) {
  const checkout = body;
  console.log("Checkout actualizado:", {
    shop,
    checkoutId: checkout.id,
    email: checkout.email,
    totalPrice: checkout.totalPrice,
    lineItemsCount: checkout.lineItems?.length,
    note: checkout.note,
  });

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}