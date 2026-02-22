import { initTRPC, TRPCError } from '@trpc/server';
import superjson from 'superjson';
import { ZodError } from 'zod';
import { db } from "../db"
import { auth } from '../auth';

// Crea el contexto de la aplicacion
// Se ejecuta en cada petición que llega al servidor
export const createTRPCContext = async (opts: { headers: Headers }) => {
  const session = await auth.api.getSession({ headers: opts.headers });
  return {
    db,                   // Conexión a la base de datos
    session,              // Sesión activa 
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


/**
 * Procedimiento protegido que requiere autenticación.
 *
 * Verifica si existe una sesión y un usuario en el contexto. Si no existen,
 * lanza un error TRPC "UNAUTHORIZED". Si existen, extiende el contexto
 * añadiendo el usuario y la sesión de forma tipada y segura.
 */
export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({
    ctx: {
      ...ctx,
      session: ctx.session,
      user: ctx.session.user,
    },
  });
});