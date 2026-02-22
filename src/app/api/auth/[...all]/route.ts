import { auth } from "@/server/auth";
import { toNextJsHandler } from "better-auth/next-js";

/**
 * Manejador de rutas API para Better Auth.
 *
 * Este archivo captura todas las peticiones que comienzan con `/api/auth/*` y las delega
 * a la librería Better Auth. Esto incluye:
 * - Endpoints de inicio de sesión y registro.
 * - Gestión de sesiones y cookies.
 * - **Callbacks de OAuth**: Aquí es donde GitHub redirige al usuario tras autenticarse (ej: /api/auth/callback/github).
 */
export const { GET, POST } = toNextJsHandler(auth);