import { createAuthClient } from "better-auth/react";

/**
 * Configuración del cliente de autenticación para el lado del cliente (React).
 *
 * Este módulo inicializa y exporta el cliente de `better-auth/react`, que proporciona
 * los hooks y funciones necesarios para interactuar con el sistema de autenticación
 * desde los componentes de React.
 *
 * - **URL Base**: Determina dinámicamente la URL base para las peticiones de autenticación,
 *   adaptándose tanto al entorno del navegador como al del servidor (durante SSR).
 * - **Funcionalidades Exportadas**: Expone métodos para iniciar sesión (`signIn`), registrarse (`signUp`),
 *   cerrar sesión (`signOut`), vincular cuentas sociales (`linkSocial`), y hooks para gestionar
 *   la sesión del usuario (`useSession`, `getSession`).
 */


const authBaseURL =
  typeof window !== "undefined"
    ? window.location.origin
    : process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export const authClient = createAuthClient({
  baseURL: authBaseURL,
});

export const { signIn, signUp, signOut, useSession, getSession, linkSocial } =
  authClient;