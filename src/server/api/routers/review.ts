import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "../trpc"; // Importa utilidades para crear routers y procedimientos protegidos en tRPC.
import { inngest } from "@/server/inngest";                     // Importa el cliente de Inngest para enviar eventos.
import {
  fetchPullRequest,
  getGitHubAccessToken,
} from "@/server/services/github";                              // Importa funciones para interactuar con la API de GitHub.

// Crea un router de tRPC para gestionar 
// las revisiones de código.
export const reviewRouter = createTRPCRouter({
  trigger: protectedProcedure                                                       // Define una mutación para disparar una nueva revisión de PR.
    .input(
      z.object({                                                                    // Define el esquema de entrada esperado.
        repositoryId: z.string(),                                                      // ID del repositorio en la base de datos.
        prNumber: z.number(),                                                          // Número del Pull Request en GitHub.
      }),
    )
    .mutation(async ({ ctx, input }) => {                                           // Lógica de la mutación.

      const repository = await ctx.db.repository.findUnique({                       // Busca el repositorio en la BD para asegurarse de que existe y pertenece al usuario.
        where: { id: input.repositoryId, userId: ctx.user.id },
      });


      if (!repository) {                                                            // Si el repositorio no se encuentra, lanza un error.
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Repository not found",
        });
      }


      const accessToken = await getGitHubAccessToken(ctx.user.id);                  // Obtiene el token de acceso a GitHub del usuario. 
      if (!accessToken) {                                                           // Si no hay token, lanza un error.
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "GitHub account not connected",
        });
      }


      const [owner, repo] = repository.fullName.split("/");                         // Extrae el propietario y el nombre del repo del 'fullName'.
      if (!owner || !repo) {                                                        // Si el nombre no es válido, lanza un error.
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid repository name",
        });
      }


      const pr = await fetchPullRequest(                                            // Obtiene los detalles del Pull Request desde la API de GitHub.
        accessToken,
        owner,
        repo,
        input.prNumber,
      );


      const review = await ctx.db.review.create({                                   // Crea un nuevo registro de revisión en la base de datos con estado 'PENDING'.
        data: {
          repositoryId: repository.id,
          userId: ctx.user.id,
          prNumber: pr.number,
          prTitle: pr.title,
          prUrl: pr.html_url,
          status: "PENDING",
        },
      });


      await inngest.send({                                                          // Envía un evento a Inngest para que procese la revisión de forma asíncrona.
        name: "review/pr.requested",                                                // Nombre del evento que activará la función de Inngest.
        data: {                                                                     // Datos necesarios para que la función de Inngest trabaje.
          reviewId: review.id,
          repositoryId: repository.id,
          prNumber: pr.number,
          userId: ctx.user.id,
        },
      });

      return { reviewId: review.id };                                               // Devuelve el ID de la revisión recién creada.
    }),

  get: protectedProcedure                                                           // Define una consulta para obtener una revisión específica por su ID.
    .input(z.object({ id: z.string() }))                                            // La entrada es el ID de la revisión.
    .query(async ({ ctx, input }) => {

      const review = await ctx.db.review.findUnique({                               // Busca la revisión en la BD, asegurándose de que pertenece al usuario.
        where: { id: input.id, userId: ctx.user.id },
        include: { repository: true },                                              // Incluye los datos del repositorio asociado.
      });


      if (!review) {                                                                // Si no se encuentra, lanza un error.
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Review not found",
        });
      }

      return review;                                                                // Devuelve la revisión encontrada.
    }),

  list: protectedProcedure                                                          // Define una consulta para listar las revisiones del usuario.
    .input(
      z.object({
        repositoryId: z.string().optional(),                                        // Permite filtrar por repositorio (opcional).
        limit: z.number().min(1).max(50).default(20),                               // Limita el número de resultados.
      }),
    )
    .query(async ({ ctx, input }) => {
      const reviews = await ctx.db.review.findMany({                                // Busca múltiples revisiones en la BD.
        where: {
          userId: ctx.user.id,                                                      // Solo las del usuario actual.
          ...(input.repositoryId && { repositoryId: input.repositoryId }),          // Aplica el filtro de repositorio si se proporciona.
        },
        include: { repository: true },                                              // Incluye los datos del repositorio.
        orderBy: { createdAt: "desc" },                                             // Ordena por fecha de creación descendente.
        take: input.limit,                                                          // Aplica el límite de resultados.
      });

      return reviews;                                                               // Devuelve la lista de revisiones.
    }),

  getLatestForPR: protectedProcedure                                                // Define una consulta para obtener la última revisión de un PR específico.
    .input(
      z.object({
        repositoryId: z.string(),
        prNumber: z.number(),
      }),
    )
    .query(async ({ ctx, input }) => {                                              // Busca la primera revisión que coincida, ordenada por fecha descendente.
      const review = await ctx.db.review.findFirst({
        where: {
          repositoryId: input.repositoryId,
          prNumber: input.prNumber,
          userId: ctx.user.id,
        },
        orderBy: { createdAt: "desc" },                                            // La más reciente primero.
      });

      return review;                                                                // Devuelve la revisión encontrada o null.
    }),
});