import { authenticate } from "../../shopify.server";

export async function loader({ request, params }) {
  const { admin } = await authenticate.admin(request);
  const { handle } = params;

  const response = await admin.graphql(
    `#graphql
      query getProductByHandle($handle: String!) {
        productByHandle(handle: $handle) {
          id
          title
          handle
          status
          tags
          vendor
          productType
          description
          descriptionHtml
          createdAt
          updatedAt
          images(first: 5) {
            edges {
              node {
                url
                altText
              }
            }
          }
          variants(first: 50) {
            edges {
              node {
                id
                title
                sku
                price
                barcode
                availableForSale
                quantityAvailable
                inventoryQuantity
                selectedOptions {
                  name
                  value
                }
                image {
                  url
                  altText
                }
              }
            }
          }
          priceRange {
            minVariantPrice {
              amount
              currencyCode
            }
            maxVariantPrice {
              amount
              currencyCode
            }
          }
          options {
            name
            values
          }
        }
      }`,
    {
      variables: { handle },
    },
  );
  const responseJson = await response.json();
  const product = responseJson.data.productByHandle;

  if (!product) {
    return new Response(JSON.stringify({ error: "Product not found" }), {
      status: 404,
    });
  }

  return {
    product: {
      ...product,
      images: product.images.edges.map(e => e.node),
      variants: product.variants.edges.map(e => e.node),
    },
  };
}