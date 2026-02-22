import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import {
  fetchGitHubRepos,
  getGitHubAccessToken,
} from "@/server/services/github";

/**
 * Router para la gestión de repositorios.
 * Permite listar repositorios locales, buscar en GitHub y gestionar la vinculación.
 */
export const repositoryRouter = createTRPCRouter({
  /**
   * Obtiene la lista de repositorios que el usuario ya ha vinculado (guardado)
   * en la base de datos local.
   *
   * @returns Array de repositorios ordenados por fecha de creación descendente.
   */
  list: protectedProcedure.query(async ({ ctx }) => {
    const repositories = await ctx.db.repository.findMany({
      where: { userId: ctx.user.id },
      orderBy: { createdAt: "desc" },
    });
    return repositories;
  }),

  /**
   * Consulta la API de GitHub para obtener todos los repositorios disponibles del usuario.
   *
   * Verifica primero si existe un token de acceso válido.
   *
   * @throws TRPCError "PRECONDITION_FAILED" si el usuario no ha conectado su cuenta de GitHub.
   */
  fetchFromGithub: protectedProcedure.query(async ({ ctx }) => {
    const accessToken = await getGitHubAccessToken(ctx.user.id);

    if (!accessToken) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "User has not authorized GitHub access",
      });
    }

    const repos = await fetchGitHubRepos(accessToken);
    return repos.map((repo) => ({
      githubId: repo.id,
      name: repo.name,
      fullName: repo.full_name,
      private: repo.private,
      htmlUrl: repo.html_url,
      description: repo.description,
      language: repo.language,
      stars: repo.stargazers_count,
      updatedAt: repo.updated_at,
    }));
  }),

  /**
   * Vincula (guarda) una lista de repositorios seleccionados en la base de datos local.
   * Utiliza `upsert` para crear nuevos registros o actualizar los existentes si ya fueron vinculados.
   */
  connect: protectedProcedure
    .input(
      z.object({
        repos: z.array(
          z.object({
            githubId: z.number(),
            name: z.string(),
            fullName: z.string(),
            private: z.boolean(),
            htmlUrl: z.string(),
          }),
        ),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const result = await Promise.all(
        input.repos.map((repo) =>
          ctx.db.repository.upsert({
            where: { githubId: repo.githubId },
            create: {
              userId: ctx.user.id,
              githubId: repo.githubId,
              name: repo.name,
              fullName: repo.fullName,
              private: repo.private,
              htmlUrl: repo.htmlUrl,
            },
            update: {
              name: repo.name,
              fullName: repo.fullName,
              private: repo.private,
              htmlUrl: repo.htmlUrl,
              updatedAt: new Date(),
            },
          }),
        ),
      );
      return { connected: result.length };
    }),

  /**
   * Desvincula (elimina) un repositorio de la base de datos local.
   */
  disconnect: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.repository.delete({
        where: { id: input.id, userId: ctx.user.id },
      });
      return { success: true };
    }),
});