import { SiteLayout } from "@practicedesk/ui";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <SiteLayout
    page="cinetreak"
    theme="dark"
    base={import.meta.env.VITE_SITE_BASE || "/"}
  >
    <App />
  </SiteLayout>,
);
