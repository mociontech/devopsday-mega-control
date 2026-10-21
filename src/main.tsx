import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { iniciarEnvioEvius } from "./lib/evius";
import "./styles.css";

iniciarEnvioEvius();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
