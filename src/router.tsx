import { createBrowserRouter, Outlet } from "react-router";
import { RequireAuth } from "./auth/RequireAuth";
import { RequireTermos } from "./auth/RequireTermos";
import { AceiteDosTermos } from "./pages/AceiteDosTermos";
import { Area } from "./pages/Area";
import { Callback } from "./pages/Callback";
import { Conta } from "./pages/Conta";
import { Landing } from "./pages/Landing";
import { NotFound } from "./pages/NotFound";
import { Privacidade } from "./pages/Privacidade";
import { Termos } from "./pages/Termos";

export const router = createBrowserRouter([
  { path: "/", element: <Landing /> },
  { path: "/callback", element: <Callback /> },
  { path: "/termos", element: <Termos /> },
  { path: "/privacidade", element: <Privacidade /> },
  {
    path: "/app",
    element: (
      <RequireAuth>
        <RequireTermos>
          <Outlet />
        </RequireTermos>
      </RequireAuth>
    ),
    children: [
      { index: true, element: <Area /> },
      { path: "conta", element: <Conta /> },
      { path: "termos", element: <AceiteDosTermos /> },
    ],
  },
  { path: "*", element: <NotFound /> },
]);
