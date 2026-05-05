export const loader = async ({ request }) => {
  const url = new URL(request.url);
  const enabled = url.searchParams.get("enabled") !== "false";
  const agentId = url.searchParams.get("agentId") || "9549bb2e-9f39-4cb8-b851-3519dee4d34d";
  const title = url.searchParams.get("title") || "Assistant";
  const subtitle = url.searchParams.get("subtitle") || "Online";
  const color = url.searchParams.get("color") || "#6366f1";
  const position = url.searchParams.get("position") || "right";
  const welcome = url.searchParams.get("welcome") || "Hi! How can I help you?";
  const theme = url.searchParams.get("theme") || "light";

  const scriptTag = enabled
    ? `<script src="https://dashboard.iagents.pro/widget/iagents-chat.js?v=3"
    data-agent-id="${agentId}"
    data-title="${title}"
    data-subtitle="${subtitle}"
    data-color="${color}"
    data-position="${position}"
    data-welcome="${welcome}"
    data-theme="${theme}"
    async>
  </script>`
    : "";

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>body{margin:0;padding:0;background:#f5f5f5;}</style>
</head>
<body>
  ${scriptTag}
</body>
</html>`;

  return new Response(html, {
    headers: {
      "Content-Type": "text/html",
      "Access-Control-Allow-Origin": "*",
    },
  });
};