import { createRoot } from "react-dom/client";
import { SiteLayout } from "@practicedesk/ui";
import App from "./App";

createRoot(document.getElementById("root")!).render(
  <SiteLayout
    page="mg10xu"
    theme="dark"
    base={import.meta.env.VITE_SITE_BASE || "/"}
    manual={{
      title: "Yamaha MG10XU",
      url: `${import.meta.env.BASE_URL}manual.pdf`,
    }}
  >
    <App />
  </SiteLayout>,
);
