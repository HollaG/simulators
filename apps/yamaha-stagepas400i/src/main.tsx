import { createRoot } from "react-dom/client";
import { SiteLayout } from "@practicedesk/ui";
import App from "./App";

createRoot(document.getElementById("root")!).render(
  <SiteLayout
    page="stagepas"
    theme="dark"
    base={import.meta.env.VITE_SITE_BASE || "/"}
    manual={{
      title: "Yamaha STAGEPAS 400i",
      url: `${import.meta.env.BASE_URL}manual.pdf`,
    }}
  >
    <App />
  </SiteLayout>,
);
