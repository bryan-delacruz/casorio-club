import { ImageResponse } from "next/og";
import { IconoApp } from "@/lib/icono-app";

// Se genera una vez en el build: el ícono no cambia entre peticiones.
export const dynamic = "force-static";

// Ícono 512 del manifest (purpose "any"): splash de Android.
export function GET() {
  return new ImageResponse(<IconoApp tamano={512} radio={112} />, { width: 512, height: 512 });
}
