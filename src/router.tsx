import { createBrowserRouter } from "react-router";
import { RequireAuth } from "./auth/RequireAuth";
import { Area } from "./pages/Area";
import { Callback } from "./pages/Callback";
import { Landing } from "./pages/Landing";
import { NotFound } from "./pages/NotFound";

export const router = createBrowserRouter([
  { path: "/", element: <Landing /> },
  { path: "/callback", element: <Callback /> },
  {
    path: "/app",
    element: (
      <RequireAuth>
        <Area />
      </RequireAuth>
    ),
  },
  { path: "*", element: <NotFound /> },
]);
