import { ImageResponse } from "next/og";
import { IconoApp } from "@/lib/icono-app";

// Se genera una vez en el build: el ícono no cambia entre peticiones.
export const dynamic = "force-static";

// Ícono 192 del manifest (purpose "any").
export function GET() {
  return new ImageResponse(<IconoApp tamano={192} radio={42} />, { width: 192, height: 192 });
}
