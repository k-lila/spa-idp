import "./config"; // valida VITE_* no boot; quem consome é auth/userManager
import { QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router";
import "./index.css";
import { queryClient } from "./api/queryClient";
import { AuthProvider } from "./auth/AuthProvider";
import { router } from "./router";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {/* Fora de AuthProvider: a etapa 6 limpa o cache ao ouvir userUnloaded */}
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
);
