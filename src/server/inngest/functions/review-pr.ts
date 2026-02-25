import { inngest } from "../client";               // Importa el cliente de Inngest para crear y gestionar funciones.
import { db } from "@/server/db";                  // Importa el cliente de la base de datos (Prisma) para interactuar con los datos.
import { reviewCode } from "@/server/services/ai"; // Importa la función que usa IA para analizar el código.
import {
  fetchPullRequest,
  fetchPullRequestFiles,
  getGitHubAccessToken,
} from "@/server/services/github";                 // Importa funciones para interactuar con la API de GitHub.

// Define la estructura del evento que dispara esta función.
export type ReviewPREvent = {
  name: "review/pr.requested"; // Nombre único del evento.
  data: {
    reviewId: string;          // ID de la revisión en la base de datos.
    repositoryId: string;      // ID del repositorio en la base de datos.
    prNumber: number;          // Número del Pull Request en GitHub.
    userId: string;            // ID del usuario que solicitó la revisión.
  };
};

// Crea una función de Inngest para procesar la 
// revisión de un Pull Request.
export const reviewPR = inngest.createFunction(
  {
    id: "review-pr",                                                   // ID único para esta función de Inngest.
    retries: 2,                                                        // Reintenta la función hasta 2 veces si falla.
  },
  { event: "review/pr.requested" },                                    // Se activa con el evento 'review/pr.requested'.
  async ({ event, step }) => {                                         // El manejador principal de la función, recibe el evento y el objeto 'step'.
    const { reviewId, repositoryId, prNumber, userId } = event.data;   // Extrae los datos del evento.

    await step.run("update-status-processing", async () => {
      await db.review.update({
        where: { id: reviewId },
        data: { status: "PROCESSING" },
      });
    });


    const repository = await step.run("get-repository", async () => {  // Obtiene los datos del repositorio desde la base de datos.
      return db.repository.findUnique({
        where: { id: repositoryId },                                   // Busca el repositorio por su ID.
      });
    });


    if (!repository) {                                                 // Si el repositorio no se encuentra, marca la revisión como fallida y termina.
      await step.run("mark-failed-no-repo", async () => {
        await db.review.update({
          where: { id: reviewId },
          data: { status: "FAILED", error: "No repository found" },   // Guarda el motivo del error.
        });
      });
      return { success: false, error: "No repository found" };         // Retorna un error.
    }

    const accessToken = await step.run("get-access-token", async () => {
      return getGitHubAccessToken(userId);
    });

    if (!accessToken) {
      await step.run("mark-failed-no-token", async () => {
        await db.review.update({
          where: { id: reviewId },
          data: {
            status: "FAILED",
            error: "GitHub access token not found",
          },
        });
      });
      return { success: false, error: "GitHub access token not found" };
    }

    const [owner, repo] = repository.fullName.split("/");              // Extrae el propietario y el nombre del repositorio del 'fullName'.
    if (!owner || !repo) {

      await step.run("mark-failed-invalid-repo", async () => {         // Si el 'fullName' no es válido, marca la revisión como fallida y termina.
        await db.review.update({
          where: { id: reviewId },
          data: {
            status: "FAILED",
            error: "Invalid repository name",
          },
        });
      });
      return { success: false, error: "Invalid repository name" };
    }

    // Obtiene la lista de archivos modificados 
    // en el Pull Request.
    const files = await step.run("fetch-pr-files", async () => {
      return fetchPullRequestFiles(accessToken, owner, repo, prNumber);  // Llama a la API de GitHub.
    });

    // Obtiene los detalles completos 
    // del Pull Request.
    const pr = await step.run("fetch-pr", async () => {
      return fetchPullRequest(accessToken, owner, repo, prNumber);      // Llama a la API de GitHub.
    });

    // Genera la revisión del código utilizando 
    // el servicio de IA.
    const reviewResult = await step.run("generate-review", async () => {
      return reviewCode(                                                // Llama a la función de IA.
        pr.title,                                                       // Pasa el título del PR.
        files.map((f) => ({                                             // Mapea los archivos a un formato simplificado.
          filename: f.filename,
          status: f.status,
          additions: f.additions,
          deletions: f.deletions,
          patch: f.patch,
        })),
      );
    });

    // Guarda los resultados de la revisión 
    // en la base de datos.
    await step.run("save-review-result", async () => {
      await db.review.update({
        where: { id: reviewId },                                        // Localiza la revisión por su ID.
        data: {
          status: "COMPLETED",                                          // Marca la revisión como completada.
          summary: reviewResult.summary,                                // Guarda el resumen de la IA.
          riskScore: reviewResult.riskScore,                            // Guarda la puntuación de riesgo.
          comments: reviewResult.comments,                              // Guarda los comentarios detallados.
        },
      });
    });

    return { success: true, reviewId };                                 // Retorna éxito y el ID de la revisión completada.
  },
);