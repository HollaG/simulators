import { SiteLayout } from "@practicedesk/ui";
import { createRoot } from "react-dom/client";
import App from "./App";
createRoot(document.getElementById("root")!).render(
  <SiteLayout
    page="mackie"
    base={import.meta.env.VITE_SITE_BASE || "/"}
    manual={{
      title: "Mackie ProFX22v3",
      url: `${import.meta.env.BASE_URL}manual.pdf`,
    }}
  >
    <App />
  </SiteLayout>,
);
