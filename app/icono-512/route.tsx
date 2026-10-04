import { ImageResponse } from "next/og";
import { IconoApp } from "@/lib/icono-app";

// Ícono 512 del manifest (purpose "any"): splash de Android.
export function GET() {
  return new ImageResponse(<IconoApp tamano={512} radio={112} />, { width: 512, height: 512 });
}
