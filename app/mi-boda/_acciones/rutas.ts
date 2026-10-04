/**
 * Las secciones de la boda, en un solo lugar: la cabecera, el selector
 * Mapa/Camino y la barra del celular enlazan a las mismas.
 */
export const RUTAS = {
  mapa: "/mi-boda",
  camino: "/mi-boda/camino",
  gastos: "/mi-boda/bernie",
  // Clerk abre su perfil de boda en "General"; quien busca "Quién está"
  // quiere ver e invitar gente, así que se entra directo a Miembros.
  equipo: "/mi-boda/equipo#/organization-members",
} as const;

/** La ruta sin el #, para comparar con usePathname(). */
export const sinHash = (href: string) => href.split("#")[0];
