import { ImageResponse } from "next/og";
import { IconoApp } from "@/lib/icono-app";

// Maskable de Android: sin esquinas (el sistema aplica su forma) y glifo dentro
// de la zona segura del 80% para que el recorte circular no corte los anillos.
export function GET() {
  return new ImageResponse(<IconoApp tamano={512} proporcion={0.66} />, { width: 512, height: 512 });
}
