"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import { useState } from "react";
import superjson from "superjson";
import { trpc } from "./client";


// Decide a que url de conectarse el cliente trpc 
// dependiendo de donde se este ejecutando la aplicacion
function getBaseUrl() {
  if (typeof window !== "undefined") return "";
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return `http://localhost:${process.env.PORT ?? 3000}`;
}

/**
 * 
 * Es el envoltorio (wrapper) que permite que toda tu aplicación de React (Frontend) tenga acceso
 * a las funcionalidades de tRPC y React Query
 * 
 */

export function TRPCProvider({ children }: { children: React.ReactNode }) {
  // Crea un cliente de React Query
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 1000,         // Los datos se consideran frescos (fresh) durante 5 segundos
            refetchOnWindowFocus: false, // No se vuelve a pedir datos cuando la ventana vuelve a tener foco
          },
        },
      }),
  );

  // Crea un cliente de tRPC
  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({                      // Si un componente pide el "Usuario" y otro pide los "Posts" al mismo tiempo, este link agrupa ambas peticiones en una sola llamada HTTP, ahorrando recursos de red.
          url: `${getBaseUrl()}/api/trpc`,      // Ruta de la api
          transformer: superjson,               // Permite que el servidor envie datos en formato json
        }),
      ],
    }),
  );

  return (
    <trpc.Provider
      client={trpcClient}
      queryClient={queryClient}
    >
      <QueryClientProvider
        client={queryClient}
      >
        {children}
      </QueryClientProvider>
    </trpc.Provider>
  );
}