import { pullRequestRouter } from "./routers/pull-request";
import { repositoryRouter } from "./routers/repository";
import { createCallerFactory, createTRPCRouter, publicProcedure } from "./trpc";

export const appRouter = createTRPCRouter({
  // Aquí es donde fusionarás tus sub-routers, por ejemplo:
  // users: userRouter,
  // posts: postRouter,
  health: publicProcedure.query(() => {
    return {
      status: "ok",
      timestamps: new Date()
    }
  }),
  repository: repositoryRouter,
  pullRequest: pullRequestRouter,
})

export type AppRouter = typeof appRouter

export const createCaller = createCallerFactory(appRouter)
