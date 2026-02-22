import { db } from "@/server/db";

/**
 * Representa un archivo modificado en un Pull Request de GitHub.
 */
export interface GitHubPullRequestFile {
  sha: string;
  filename: string;
  status:
  | "added"
  | "removed"
  | "modified"
  | "renamed"
  | "copied"
  | "changed"
  | "unchanged";
  additions: number;
  deletions: number;
  changes: number;
  patch?: string;
  previous_filename?: string;
}

/**
 * Representa un usuario de GitHub.
 */
export interface GitHubUser {
  login: string;
  avatar_url: string;
}

/**
 * Representa un Pull Request de GitHub con detalles extendidos.
 */
export interface GitHubPullRequest {
  id: number;
  number: number;
  title: string;
  state: "open" | "closed";
  html_url: string;
  user: GitHubUser;
  created_at: string;
  updated_at: string;
  merged_at: string | null;
  draft: boolean;
  head: {
    ref: string;
    sha: string;
  };
  base: {
    ref: string;
  };
  additions: number;
  deletions: number;
  changed_files: number;
}

/**
 * Representa un repositorio de GitHub.
 */
export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  html_url: string;
  description: string | null;
  language: string | null;
  stargazers_count: number;
  updated_at: string;
}

/**
 * Obtiene el token de acceso de GitHub para un usuario específico desde la base de datos.
 *
 * @param userId - El ID del usuario en la base de datos local.
 * @returns El token de acceso (string) si existe, o null si no se encuentra.
 */
export async function getGitHubAccessToken(
  userId: string,
): Promise<string | null> {
  const account = await db.account.findFirst({
    where: {
      userId,
      providerId: "github",
    },
    select: {
      accessToken: true,
    },
  });

  return account?.accessToken ?? null;
}

/**
 * Obtiene todos los repositorios a los que tiene acceso el usuario autenticado.
 * Maneja la paginación automáticamente para recuperar la lista completa.
 *
 * @param accessToken - El token de acceso de GitHub.
 * @returns Una promesa con un array de repositorios.
 */
export async function fetchGitHubRepos(
  accessToken: string,
): Promise<GitHubRepo[]> {
  const repos: GitHubRepo[] = [];
  let page = 1;
  const perPage = 100;

  while (true) {
    const response = await fetch(
      `https://api.github.com/user/repos?per_page=${perPage}&page=${page}&sort=updated`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/vnd.github.v3+json",
        },
      },
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch GitHub repos: ${response.status}`);
    }

    const data = (await response.json()) as GitHubRepo[];
    repos.push(...data);
    if (data.length < perPage) break;
    page++;
  }

  return repos;
}

/**
 * Obtiene los Pull Requests de un repositorio específico.
 *
 * Nota: La API de lista de PRs no devuelve estadísticas detalladas (additions, deletions),
 * por lo que esta función hace una llamada adicional por cada PR para obtener esos datos.
 *
 * @param accessToken - El token de acceso de GitHub.
 * @param owner - El propietario del repositorio (usuario u organización).
 * @param repo - El nombre del repositorio.
 * @param state - El estado de los PRs a buscar ("open", "closed", "all"). Por defecto "open".
 * @returns Una promesa con un array de Pull Requests detallados.
 */
export async function fetchPullRequests(
  accessToken: string,
  owner: string,
  repo: string,
  state: "open" | "closed" | "all" = "open",
): Promise<GitHubPullRequest[]> {
  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/pulls?state=${state}&per_page=30&sort=updated&direction=desc`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.github.v3+json",
      },
    },
  );

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status}`);
  }

  const pulls = (await response.json()) as GitHubPullRequest[];

  // The list endpoint doesn't include additions/deletions/changed_files,
  // so we fetch each PR individually to get those stats.
  const detailed = await Promise.all(
    pulls.map((pr) => fetchPullRequest(accessToken, owner, repo, pr.number)),
  );

  return detailed;
}

/**
 * Obtiene los detalles de un Pull Request específico.
 *
 * @param accessToken - El token de acceso de GitHub.
 * @param owner - El propietario del repositorio.
 * @param repo - El nombre del repositorio.
 * @param prNumber - El número del Pull Request.
 * @returns Una promesa con los detalles del Pull Request.
 */
export async function fetchPullRequest(
  accessToken: string,
  owner: string,
  repo: string,
  prNumber: number,
): Promise<GitHubPullRequest> {
  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.github.v3+json",
      },
    },
  );

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status}`);
  }

  return (await response.json()) as GitHubPullRequest;
}

/**
 * Obtiene la lista de archivos modificados en un Pull Request.
 * Maneja la paginación automáticamente.
 *
 * @param accessToken - El token de acceso de GitHub.
 * @param owner - El propietario del repositorio.
 * @param repo - El nombre del repositorio.
 * @param prNumber - El número del Pull Request.
 * @returns Una promesa con un array de archivos modificados.
 */
export async function fetchPullRequestFiles(
  accessToken: string,
  owner: string,
  repo: string,
  prNumber: number,
): Promise<GitHubPullRequestFile[]> {
  const files: GitHubPullRequestFile[] = [];
  let page = 1;
  const perPage = 100;

  while (true) {
    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}/files?per_page=${perPage}&page=${page}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/vnd.github.v3+json",
        },
      },
    );

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`);
    }

    const data = (await response.json()) as GitHubPullRequestFile[];
    files.push(...data);

    if (data.length < perPage) break;
    page++;
  }

  return files;
}