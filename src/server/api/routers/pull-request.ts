import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import {
  fetchPullRequests,
  fetchPullRequest,
  getGitHubAccessToken,
  fetchPullRequestFiles,
} from "@/server/services/github";

/**
 * Router para gestionar operaciones relacionadas con Pull Requests.
 * Permite listar PRs, obtener detalles individuales y consultar archivos modificados,
 * integrando datos de la API de GitHub con la base de datos local.
 */
export const pullRequestRouter = createTRPCRouter({
  /**
   * Obtiene una lista de Pull Requests de un repositorio vinculado.
   * Incluye el estado de revisión local si existe.
   */
  list: protectedProcedure
    .input(
      z.object({
        repositoryId: z.string(),
        state: z.enum(["open", "closed", "all"]).default("open"),
      }),
    )
    .query(async ({ ctx, input }) => {
      // 1. Verificar que el repositorio existe y pertenece al usuario
      const repository = await ctx.db.repository.findUnique({
        where: { id: input.repositoryId, userId: ctx.user.id },
      });

      if (!repository) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Repository not found",
        });
      }

      // 2. Obtener el token de acceso de GitHub del usuario
      const accessToken = await getGitHubAccessToken(ctx.user.id);
      if (!accessToken) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Github account not connected",
        });
      }

      // 3. Extraer propietario y nombre del repositorio
      const [owner, repo] = repository.fullName.split("/");
      if (!owner || !repo) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid repository name",
        });
      }

      // 4. Consultar la API de GitHub para obtener los PRs
      const prs = await fetchPullRequests(
        accessToken,
        owner,
        repo,
        input.state,
      );

      // 5. Buscar revisiones existentes en la BD local para estos PRs
      const existingReviews = await ctx.db.review.findMany({
        where: {
          repositoryId: repository.id,
          prNumber: { in: prs.map((pr) => pr.number) },
        },
        select: {
          prNumber: true,
          status: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      });

      // Mapa para asociar rápidamente revisiones a PRs
      const reviewMap = new Map(existingReviews.map((r) => [r.prNumber, r]));

      // 6. Retornar datos combinados (GitHub + Estado local)
      return prs.map((pr) => ({
        id: pr.id,
        number: pr.number,
        title: pr.title,
        state: pr.state,
        draft: pr.draft,
        htmlUrl: pr.html_url,
        author: {
          login: pr.user.login,
          avatarUrl: pr.user.avatar_url,
        },
        headRef: pr.head.ref,
        baseRef: pr.base.ref,
        additions: pr.additions,
        deletions: pr.deletions,
        changedFiles: pr.changed_files,
        createdAt: pr.created_at,
        updatedAt: pr.updated_at,
        mergedAt: pr.merged_at,
        review: reviewMap.get(pr.number) ?? null,
      }));
    }),

  /**
   * Obtiene los detalles de un Pull Request específico.
   */
  get: protectedProcedure
    .input(
      z.object({
        repositoryId: z.string(),
        prNumber: z.number(),
      }),
    )
    .query(async ({ ctx, input }) => {
      // 1. Verificar repositorio
      const repository = await ctx.db.repository.findUnique({
        where: { id: input.repositoryId, userId: ctx.user.id },
      });

      if (!repository) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Repository not found",
        });
      }

      // 2. Verificar token
      const accessToken = await getGitHubAccessToken(ctx.user.id);
      if (!accessToken) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "GitHub account not connected",
        });
      }

      const [owner, repo] = repository.fullName.split("/");
      if (!owner || !repo) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid repository name",
        });
      }

      // 3. Obtener detalles del PR desde GitHub
      const pr = await fetchPullRequest(
        accessToken,
        owner,
        repo,
        input.prNumber,
      );

      // 4. Obtener revisión local si existe
      const existingReview = await ctx.db.review.findFirst({
        where: {
          repositoryId: repository.id,
          prNumber: pr.number,
        },
        orderBy: { createdAt: "desc" },
      });

      return {
        id: pr.id,
        number: pr.number,
        title: pr.title,
        state: pr.state,
        draft: pr.draft,
        htmlUrl: pr.html_url,
        author: {
          login: pr.user.login,
          avatarUrl: pr.user.avatar_url,
        },
        headRef: pr.head.ref,
        headSha: pr.head.sha,
        baseRef: pr.base.ref,
        additions: pr.additions,
        deletions: pr.deletions,
        changedFiles: pr.changed_files,
        createdAt: pr.created_at,
        updatedAt: pr.updated_at,
        mergedAt: pr.merged_at,
        review: existingReview,
      };
    }),

  /**
   * Obtiene la lista de archivos modificados en un Pull Request.
   */
  files: protectedProcedure
    .input(
      z.object({
        repositoryId: z.string(),
        prNumber: z.number(),
      }),
    )
    .query(async ({ ctx, input }) => {
      // 1. Verificar repositorio
      const repository = await ctx.db.repository.findUnique({
        where: { id: input.repositoryId, userId: ctx.user.id },
      });

      if (!repository) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Repository not found",
        });
      }

      // 2. Verificar token
      const accessToken = await getGitHubAccessToken(ctx.user.id);
      if (!accessToken) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "GitHub account not connected",
        });
      }

      const [owner, repo] = repository.fullName.split("/");
      if (!owner || !repo) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid repository name",
        });
      }

      // 3. Obtener archivos desde GitHub
      const files = await fetchPullRequestFiles(
        accessToken,
        owner,
        repo,
        input.prNumber,
      );

      return files.map((file) => ({
        sha: file.sha,
        filename: file.filename,
        status: file.status,
        additions: file.additions,
        deletions: file.deletions,
        changes: file.changes,
        patch: file.patch,
        previousFilename: file.previous_filename,
      }));
    }),
});
