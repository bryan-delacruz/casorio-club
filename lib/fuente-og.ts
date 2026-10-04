import "server-only";

/**
 * Fuentes de la marca para imágenes de next/og. Google Fonts entrega TTF (lo
 * que satori lee) cuando no se pide como navegador, y con `text` baja solo
 * los glifos de esa imagen: unos pocos KB. Si falla, la imagen sale igual con
 * la fuente por defecto en vez de romperse.
 */
export async function fuenteGoogle(familia: string, peso: number, texto: string) {
  try {
    const css = await fetch(
      `https://fonts.googleapis.com/css2?family=${familia.replace(/ /g, "+")}:wght@${peso}&text=${encodeURIComponent(texto)}`,
    ).then((r) => r.text());
    const url = css.match(/src: url\((.+?)\) format\('(?:opentype|truetype)'\)/)?.[1];
    if (!url) return null;
    const datos = await fetch(url).then((r) => r.arrayBuffer());
    return { name: familia, data: datos, weight: peso as 400 | 500, style: "normal" as const };
  } catch {
    return null;
  }
}
