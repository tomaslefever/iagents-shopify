import { useState, useEffect } from "react";
import { useFetcher, useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = session?.shop || "";
  const config = await prisma.widgetConfig.findUnique({ where: { shop } });
  return { shop, config };
};

export const action = async ({ request }) => {
  const { session, admin } = await authenticate.admin(request);
  const shop = session?.shop || "";
  const formData = await request.formData();

  const data = {
    enabled: formData.get("enabled") === "true",
    agentId: formData.get("agentId") ?? "",
    title: formData.get("title") ?? "",
    subtitle: formData.get("subtitle") ?? "",
    color: formData.get("color") ?? "",
    position: formData.get("position") ?? "",
    welcome: formData.get("welcome") ?? "",
    theme: formData.get("theme") ?? "",
  };

  const source = "web-widget";
  const channel = "shopify";

  const config = await prisma.widgetConfig.upsert({
    where: { shop },
    update: data,
    create: { shop, ...data },
  });

  const metafieldValue = JSON.stringify({ ...data, source, channel });

  const shopResponse = await admin.graphql(`#graphql
    query { shop { id } }
  `);
  const shopData = await shopResponse.json();
  const shopId = shopData.data.shop.id;

  await admin.graphql(
    `#graphql
    mutation metafieldsSet($metafields: [MetafieldsSetInput!]!) {
      metafieldsSet(metafields: $metafields) {
        metafields { id }
        userErrors { field message }
      }
    }`,
    {
      variables: {
        metafields: [
          {
            namespace: "app",
            key: "widget_config",
            type: "json",
            value: metafieldValue,
            ownerId: shopId,
          },
        ],
      },
    },
  );

  return { saved: true, config };
};

const colorPresets = [
  "#6366f1", "#8b5cf6", "#ec4899", "#ef4444",
  "#f97316", "#eab308", "#22c55e", "#14b8a6",
  "#06b6d4", "#3b82f6", "#1e293b", "#64748b",
];

export default function Index() {
  const { config } = useLoaderData();
  const fetcher = useFetcher();
  const [enabled, setEnabled] = useState(config?.enabled ?? true);
  const [agentId, setAgentId] = useState(config?.agentId ?? "");
  const [title, setTitle] = useState(config?.title ?? "");
  const [subtitle, setSubtitle] = useState(config?.subtitle ?? "");
  const [color, setColor] = useState(config?.color ?? "");
  const [position, setPosition] = useState(config?.position ?? "");
  const [welcome, setWelcome] = useState(config?.welcome ?? "");
  const [theme, setTheme] = useState(config?.theme ?? "");
  const source = "web-widget";
  const channel = "shopify";

  const val = (setter) => (e) => setter(typeof e === "string" ? e : e.target.value);

  const handleSave = () => {
    fetcher.submit(
      {
        enabled: enabled ? "true" : "false",
        agentId, title, subtitle, color, position, welcome, theme, source, channel,
      },
      { method: "post" },
    );
  };

  const scriptSrc = `https://dashboard.iagents.pro/widget/iagents-chat.js?v=4`;
  const scriptCode = `<script src="${scriptSrc}" data-agent-id="${agentId}" data-title="${title}" data-subtitle="${subtitle}" data-color="${color}" data-position="${position}" data-welcome="${welcome}" data-theme="${theme}" data-source="${source}" data-channel="${channel}" async></script>`;

  return (
    <s-page heading="iAgents - AI Sales Assistant">
      <s-section heading="About">
        <s-paragraph>
          iAgents is an AI-powered sales assistant that helps your store recommend products
          and manage customer inquiries. The agent can search your product catalog,
          check real-time inventory, and assist customers with their purchase decisions.
        </s-paragraph>
      </s-section>

      <s-section heading="Features">
        <s-unordered-list>
          <s-list-item><strong>Product Search</strong> - Search and browse your entire catalog</s-list-item>
          <s-list-item><strong>Inventory Check</strong> - Real-time stock levels by location</s-list-item>
          <s-list-item><strong>Product Recommendations</strong> - AI-driven suggestions for customers</s-list-item>
          <s-list-item><strong>Webhook Events</strong> - Real-time checkout and order notifications</s-list-item>
        </s-unordered-list>
      </s-section>

      <s-section heading="Widget Configuration">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div>
            <s-stack gap="base">
              <s-checkbox
                label="Enable chat widget on storefront"
                checked={enabled}
                onChange={(e) => setEnabled(e?.target ? e.target.checked : !!e)}
              />
              <s-text-field label="Agent ID" value={agentId} onChange={val(setAgentId)} />
              <s-text-field label="Title" value={title} onChange={val(setTitle)} />
              <s-text-field label="Subtitle" value={subtitle} onChange={val(setSubtitle)} />
              <s-text-field label="Color" value={color} onChange={val(setColor)} />
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {colorPresets.map((c) => (
                  <button key={c} type="button" onClick={() => setColor(c)}
                    style={{
                      width: 28, height: 28, background: c,
                      border: color === c ? "3px solid #1a1a1a" : "none",
                      borderRadius: 5, cursor: "pointer",
                    }}
                  />
                ))}
              </div>
              <s-select label="Position" value={position} onChange={val(setPosition)}
                options={JSON.stringify([
                  { label: "Right", value: "right" },
                  { label: "Left", value: "left" },
                ])} />
              <s-text-field label="Welcome Message" value={welcome} onChange={val(setWelcome)} />
              <s-select label="Theme" value={theme} onChange={val(setTheme)}
                options={JSON.stringify([
                  { label: "Light", value: "light" },
                  { label: "Dark", value: "dark" },
                ])} />
              <s-button variant="primary" onClick={handleSave}>
                {fetcher.state === "submitting" ? "Saving..." : "Save Configuration"}
              </s-button>
            </s-stack>
          </div>

          <div>
            <s-heading level="strong">Preview</s-heading>
            <iframe
              srcDoc={`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>body{margin:0;padding:0;background:#f5f5f5;font-family:system-ui;color:#64748b;display:flex;align-items:center;justify-content:center;height:100vh;}</style>
</head>
<body>
  ${enabled
    ? `<script src="${scriptSrc}" data-agent-id="${agentId}" data-title="${title}" data-subtitle="${subtitle}" data-color="${color}" data-position="${position}" data-welcome="${welcome}" data-theme="${theme}" data-source="${source}" data-channel="${channel}" async><\/script>`
    : `<div>Widget disabled</div>`}
</body>
</html>`}
              style={{ width: "100%", height: 500, border: "1px solid #e0e0e0", borderRadius: 8 }}
              sandbox="allow-scripts allow-same-origin"
            />
          </div>
        </div>
      </s-section>
    </s-page>
  );
}

export const headers = (headersArgs) => boundary.headers(headersArgs);