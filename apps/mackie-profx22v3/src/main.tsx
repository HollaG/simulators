import { SiteLayout } from '@practicedesk/ui';
import { createRoot } from "react-dom/client";
import App from "./App";
createRoot(document.getElementById("root")!).render(<SiteLayout page="mackie" base={import.meta.env.VITE_SITE_BASE || "/"}><App /></SiteLayout>);
