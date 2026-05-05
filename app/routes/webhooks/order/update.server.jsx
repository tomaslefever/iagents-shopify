import { authenticate } from "../../shopify.server";

export async function action({ request }) {
  const { topic, shop, body } = await authenticate.webhook(request);

  console.log(`[Webhook] ${topic} from ${shop}`);

  switch (topic) {
    case "orders/updated":
      return handleOrderUpdate(shop, body);
    default:
      return new Response(`Unhandled webhook topic: ${topic}`, { status: 404 });
  }
}

function handleOrderUpdate(shop, body) {
  const order = body;
  console.log("Orden actualizada:", {
    shop,
    orderId: order.id,
    orderNumber: order.name,
    financialStatus: order.financialStatus,
    fulfillmentStatus: order.fulfillmentStatus,
  });

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}