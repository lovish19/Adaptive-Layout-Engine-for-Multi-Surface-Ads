import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { createBrowserMeasurer } from "./rendering/measureText";
import "./styles.css";

const measureText = createBrowserMeasurer();
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App measureText={measureText} />
  </StrictMode>,
);
