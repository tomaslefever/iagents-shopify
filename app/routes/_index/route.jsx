import { redirect, Form, useLoaderData } from "react-router";
import { login } from "../../shopify.server";
import styles from "./styles.module.css";

export const loader = async ({ request }) => {
  const url = new URL(request.url);
  if (url.searchParams.get("shop")) {
    throw redirect(`/app?${url.searchParams.toString()}`);
  }
  return {
    showForm: Boolean(login),
    agentId: "9549bb2e-9f39-4cb8-b851-3519dee4d34d",
    title: "Bárbara",
    subtitle: "Online · Replies instantly",
    color: "#6366f1",
    position: "right",
    welcome: "Hi! How can I help you?",
    theme: "light",
  };
};

export default function App() {
  const { showForm, agentId, title, subtitle, color, position, welcome, theme } = useLoaderData();

  const widgetSrc = `https://dashboard.iagents.pro/widget/iagents-chat.js?v=3&agentId=${agentId}&title=${title}&subtitle=${subtitle}&color=${encodeURIComponent(color)}&position=${position}&welcome=${encodeURIComponent(welcome)}&theme=${theme}`;

  return (
    <>
      <iframe
        src={widgetSrc}
        style={{
          position: "fixed",
          bottom: "20px",
          [position]: "20px",
          width: "60px",
          height: "60px",
          border: "none",
          zIndex: "2147483647",
        }}
        title="iAgents Chat Widget"
      />
      <div className={styles.index}>
        <div className={styles.content}>
          <h1 className={styles.heading}>iAgents - AI Sales Assistant</h1>
          <p className={styles.text}>
            AI-powered sales assistant that helps your store recommend products
            and manage customer inquiries.
          </p>
          {showForm && (
            <Form className={styles.form} method="post" action="/auth/login">
              <label className={styles.label}>
                <span>Shop domain</span>
                <input className={styles.input} type="text" name="shop" />
                <span>e.g: my-shop-domain.myshopify.com</span>
              </label>
              <button className={styles.button} type="submit">
                Log in
              </button>
            </Form>
          )}
          <ul className={styles.list}>
            <li><strong>Product Search</strong> - Search and browse your entire catalog</li>
            <li><strong>Inventory Check</strong> - Real-time stock levels</li>
            <li><strong>Product Recommendations</strong> - AI-driven suggestions</li>
          </ul>
        </div>
      </div>

      <script
        src="https://dashboard.iagents.pro/widget/iagents-chat.js?v=3"
        data-agent-id={agentId}
        data-title={title}
        data-subtitle={subtitle}
        data-color={color}
        data-position={position}
        data-welcome={welcome}
        data-theme={theme}
        async
      />
    </>
  );
}