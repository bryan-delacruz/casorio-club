import { clerkMiddleware } from "@clerk/nextjs/server";

/**
 * Solo adjunta el estado de sesión a la petición.
 *
 * La protección no se hace aquí a propósito: Clerk desaconseja proteger por
 * coincidencia de rutas, porque el patrón puede desalinearse de cómo Next
 * enruta y dejar accesible algo privado. Cada zona protegida llama a
 * `auth.protect()` por su cuenta — ver app/mi-boda/layout.tsx.
 */
export default clerkMiddleware();

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
