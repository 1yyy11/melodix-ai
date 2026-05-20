// import { createRoot } from "react-dom/client";
// import App from "./App";
// import "./index.css";
// import { GoogleOAuthProvider } from '@react-oauth/google';

// <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID}>
//   <App />
// </GoogleOAuthProvider>
// createRoot(document.getElementById("root")!).render(<App />);
import { createRoot } from "react-dom/client";
import { ThemeProvider } from "next-themes"; 
import App from "./App";
import "./index.css";

import { GoogleOAuthProvider } from "@react-oauth/google";

createRoot(document.getElementById("root")!).render(
  <GoogleOAuthProvider
    clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID}
  >
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}> {/* ← ДОБАВИТЬ */}
    <App />
    </ThemeProvider> {/* ← ДОБАВИТЬ */}
  </GoogleOAuthProvider>
);