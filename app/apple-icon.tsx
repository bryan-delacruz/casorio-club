import { ImageResponse } from "next/og";
import { IconoApp } from "@/lib/icono-app";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** Ícono de iOS al "Agregar a pantalla de inicio" (iOS redondea las esquinas). */
export default function AppleIcon() {
  return new ImageResponse(<IconoApp tamano={180} />, { ...size });
}
