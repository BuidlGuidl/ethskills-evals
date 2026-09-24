import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { App } from "./pay/App";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/pay" element={<App />} />
        <Route path="*" element={<Navigate to="/pay" replace />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
