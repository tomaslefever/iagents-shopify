import { authenticate } from "../../shopify.server";

export async function action({ request }) {
  const { topic, shop, body } = await authenticate.webhook(request);

  console.log(`[Webhook] ${topic} from ${shop}`);

  switch (topic) {
    case "orders/create":
      return handleOrderCreate(shop, body);
    default:
      return new Response(`Unhandled webhook topic: ${topic}`, { status: 404 });
  }
}

function handleOrderCreate(shop, body) {
  const order = body;
  console.log("Orden creada:", {
    shop,
    orderId: order.id,
    orderNumber: order.name,
    email: order.email,
    totalPrice: order.totalPrice,
    financialStatus: order.financialStatus,
    lineItemsCount: order.lineItems?.length,
  });

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}