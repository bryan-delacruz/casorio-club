import type { ReactElement } from "react";

/**
 * Dos anillos entrelazados: el matrimonio civil en un solo trazo. Arena y
 * marfil sobre el mismo degradado vino de la tarjeta Open Graph, para que la
 * app instalada se reconozca como la misma marca que el link compartido.
 */
const ANILLOS =
  "<circle cx='12.5' cy='16' r='7' stroke='#ad9e89'/><circle cx='19.5' cy='16' r='7' stroke='#e7e5db'/>";

const anillosUri = `data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32' fill='none' stroke-width='2.2'>${ANILLOS}</svg>`,
)}`;

/**
 * Ícono de la app instalada (manifest, apple-touch-icon). `proporcion` deja
 * margen: el ícono maskable de Android recorta hasta un círculo del 80%.
 */
export function IconoApp({
  tamano,
  radio = 0,
  proporcion = 0.84,
}: {
  tamano: number;
  radio?: number;
  proporcion?: number;
}): ReactElement {
  const glifo = Math.round(tamano * proporcion);
  return (
    <div
      style={{
        width: tamano,
        height: tamano,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(150deg, #6b1a11 0%, #49110b 55%, #2a0a06 100%)",
        borderRadius: radio,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img width={glifo} height={glifo} src={anillosUri} alt="" />
    </div>
  );
}
