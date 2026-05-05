import { authenticate } from "../../shopify.server";

export async function loader({ request }) {
  const { admin } = await authenticate.admin(request);
  const url = new URL(request.url);
  const productId = url.searchParams.get("productId");
  const locationId = url.searchParams.get("locationId");

  if (!productId) {
    return new Response(JSON.stringify({ error: "productId is required" }), {
      status: 400,
    });
  }

  const query = locationId
    ? `#graphql
      query getInventoryByLocation($productId: ID!, $locationId: ID!) {
        product(id: $productId) {
          id
          title
          handle
          variants(first: 50) {
            edges {
              node {
                id
                title
                sku
                quantityAvailable
                inventoryQuantity
                inventoryItem {
                  id
                  inventoryLevels(first: 10) {
                    edges {
                      node {
                        available
                        incoming
                        item {
                          id
                        }
                        location {
                          id
                          name
                          addresses {
                            address1
                            city
                            province
                            country
                            zip
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }`
    : `#graphql
      query getInventoryLevels($productId: ID!) {
        product(id: $productId) {
          id
          title
          handle
          variants(first: 50) {
            edges {
              node {
                id
                title
                sku
                quantityAvailable
                inventoryQuantity
                inventoryItem {
                  id
                  inventoryLevels(first: 10) {
                    edges {
                      node {
                        available
                        incoming
                        item {
                          id
                        }
                        location {
                          id
                          name
                          addresses {
                            address1
                            city
                            province
                            country
                            zip
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }`;

  const variables = locationId
    ? { productId, locationId }
    : { productId };

  const response = await admin.graphql(query, { variables });
  const responseJson = await response.json();

  const product = responseJson.data.product;
  if (!product) {
    return new Response(JSON.stringify({ error: "Product not found" }), {
      status: 404,
    });
  }

  const inventory = product.variants.edges.map(edge => {
    const variant = edge.node;
    const levels = variant.inventoryItem?.inventoryLevels.edges.map(e => e.node) || [];
    return {
      variant,
      inventoryLevels: locationId
        ? levels
        : levels.map(level => ({
            ...level,
            location: level.location,
          })),
    };
  });

  return { product: { id: product.id, title: product.title, handle: product.handle }, inventory };
}