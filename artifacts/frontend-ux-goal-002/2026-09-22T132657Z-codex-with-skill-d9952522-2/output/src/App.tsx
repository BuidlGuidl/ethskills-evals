import { useEffect } from "react";

import { PayPage } from "./pages/PayPage";

export default function App() {
  useEffect(() => {
    if (window.location.pathname !== "/pay") {
      window.history.replaceState(null, "", "/pay");
    }
  }, []);

  return <PayPage />;
}
