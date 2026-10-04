import type { MetadataRoute } from "next";

/** Web App Manifest: Casorio se instala como app en Android e iOS. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Casorio Club",
    short_name: "Casorio",
    description:
      "Los pendientes, trámites, compras y gastos de tu matrimonio civil, junto a quien lo organiza contigo.",
    id: "/mi-boda",
    start_url: "/mi-boda",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#e7e5db",
    theme_color: "#49110b",
    lang: "es-PE",
    dir: "ltr",
    categories: ["lifestyle", "productivity"],
    icons: [
      { src: "/icono-192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icono-512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icono-maskable", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
