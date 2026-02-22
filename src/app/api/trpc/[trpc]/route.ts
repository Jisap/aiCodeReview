import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "@/server/api/root";
import { createTRPCContext } from "@/server/api/trpc";

// Conecta el frontend con el backend
// Crea el handler para la ruta /api/trpc
const handler = (req: Request) => fetchRequestHandler({             // toma una peticion http y la traduce a algo que el router trpc pueda entender
  endpoint: '/api/trpc',                                            // ruta de la api
  req,                                                              // peticion http
  router: appRouter,                                                // router de la api
  createContext: () => createTRPCContext({ headers: req.headers }), // contexto de la api
  onError:
    process.env.NODE_ENV === "development"
      ? ({ path, error }) => {
        console.error(
          `❌ tRPC failed on ${path ?? "<no-path>"}: ${error.message}`,
        );
      }
      : undefined,
});

export { handler as GET, handler as POST };
