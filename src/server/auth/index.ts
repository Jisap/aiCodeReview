import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { db } from "../db";

/**
 * Configuración principal del sistema de autenticación utilizando Better Auth.
 *
 * Esta instancia se encarga de gestionar todo el ciclo de vida de la autenticación:
 * - **Persistencia**: Utiliza Prisma Adapter (PostgreSQL) para almacenar usuarios y sesiones.
 * - **Métodos de Acceso**: Habilita inicio de sesión con Email/Contraseña y OAuth con GitHub.
 * - **Gestión de Cuentas**: Permite la vinculación automática de cuentas (Account Linking) para proveedores confiables.
 * - **Sesiones**: Configura la duración de la sesión (7 días), frecuencia de actualización y caché en cookies.
 * - **Seguridad**: Restringe las peticiones a los orígenes confiables definidos en las variables de entorno.
 */

export const auth = betterAuth({
  database: prismaAdapter(db, {
    provider: "postgresql",
  }),
  emailAndPassword: {
    enabled: true,
  },
  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      /**
       * Scopes (Permisos) solicitados a GitHub:
       * - read:user: Leer perfil público.
       * - user:email: Obtener email (necesario para el registro).
       * - repo: Acceso completo a repositorios (necesario para listar/editar repos).
       */
      scope: ["read:user", "user:email", "repo"],
    },
  },
  account: {
    /**
     * Configuración de Vinculación de Cuentas:
     * Permite unificar usuarios si usan el mismo email en diferentes métodos (ej: Email y GitHub).
     * - trustedProviders: Lista de proveedores seguros (como GitHub) que verifican el email,
     *   permitiendo la vinculación automática sin pasos extra de seguridad.
     */
    accountLinking: {
      enabled: true,
      trustedProviders: ["github"],
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 24 hours
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5, // 5 minutes
    },
  },
  trustedOrigins: [process.env.BETTER_AUTH_URL!],
});

export type Session = typeof auth.$Infer.Session;