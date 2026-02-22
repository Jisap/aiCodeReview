import { initTRPC } from '@trpc/server';
import superjson from 'superjson';
import { ZodError } from 'zod';
import { db } from "../db"

// Crea el contexto de la aplicacion
// Se ejecuta en cada petición que llega al servidor
export const createTRPCContext = async (opts: { headers: Headers }) => {
  return {
    db,                   // Conexión a la base de datos
    headers: opts.headers // Encabezados de la petición
  }
}

// Inicializa el servidor trpc
// indicando el tipo de datos del contexto
const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,            // Permite que el servidor envie datos en formato json
  errorFormatter({ shape, error }) { // Formatea los errores
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError: error.cause instanceof ZodError ? error.cause.flatten() : null
      }
    }
  }
});


// Exporta las funciones
export const createCallerFactory = t.createCallerFactory; // Invoca funciones desde el server
export const createTRPCRouter = t.router;                 // Agrupa multiples rutas en un solo objeto 
export const publicProcedure = t.procedure;               // Ruta pública para acceder a la api             