import { QueryClient } from "@tanstack/react-query";
import { UnauthorizedError } from "./http";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 401 nunca é retentado (ADR 0008). Uma retentativa para o resto: o padrão (3, com backoff)
      // levaria ~7 s até a falha aparecer. `refetchOnWindowFocus` e `staleTime` no padrão.
      retry: (failureCount, error) => !(error instanceof UnauthorizedError) && failureCount < 1,
    },
  },
});
