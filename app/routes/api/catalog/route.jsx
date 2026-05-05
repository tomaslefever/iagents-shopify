import { unauthenticated } from "../../shopify.server";

export async function loader({ request }) {
  const { admin } = await unauthenticated.admin(request);
  const url = new URL(request.url);
  const query = url.searchParams.get("query") || "";
  const first = parseInt(url.searchParams.get("first")) || 10;

  const graphqlQuery = query
    ? `#graphql
      query searchProducts($query: String!, $first: Int!) {
        products(first: $first, query: $query) {
          edges {
            node {
              id
              title
              handle
              status
              tags
              vendor
              productType
              images(first: 1) {
                edges {
                  node {
                    url
                    altText
                  }
                }
              }
              variants(first: 10) {
                edges {
                  node {
                    id
                    title
                    sku
                    price
                    availableForSale
                    quantityAvailable
                  }
                }
              }
              priceRange {
                minVariantPrice {
                  amount
                  currencyCode
                }
              }
            }
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }`
    : `#graphql
      query getProducts($first: Int!) {
        products(first: $first) {
          edges {
            node {
              id
              title
              handle
              status
              tags
              vendor
              productType
              images(first: 1) {
                edges {
                  node {
                    url
                    altText
                  }
                }
              }
              variants(first: 10) {
                edges {
                  node {
                    id
                    title
                    sku
                    price
                    availableForSale
                    quantityAvailable
                  }
                }
              }
              priceRange {
                minVariantPrice {
                  amount
                  currencyCode
                }
              }
            }
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }`;

  const variables = query ? { query, first } : { first };

  const response = await admin.graphql(graphqlQuery, { variables });
  const responseJson = await response.json();

  const products = responseJson.data.products.edges.map(edge => ({
    ...edge.node,
    image: edge.node.images.edges[0]?.node,
    variants: edge.node.variants.edges.map(v => v.node),
  }));

  return Response.json({
    products,
    pageInfo: responseJson.data.products.pageInfo,
  });
}