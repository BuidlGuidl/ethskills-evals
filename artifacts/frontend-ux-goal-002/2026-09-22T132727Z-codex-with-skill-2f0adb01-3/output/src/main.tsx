import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { PayPanel } from "./pay/pay-panel";
import { Providers } from "./providers";
import "./globals.css";

if (window.location.pathname !== "/pay") {
  window.history.replaceState(null, "", "/pay");
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Providers>
      <PayPanel />
    </Providers>
  </StrictMode>,
);
