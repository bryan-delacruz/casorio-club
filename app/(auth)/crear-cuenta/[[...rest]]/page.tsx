import type { Metadata } from "next";
import { SignUp } from "@clerk/nextjs";

export const metadata: Metadata = { title: "Crear cuenta" };

export default function CrearCuentaPage() {
  return <SignUp signInUrl="/entrar" forceRedirectUrl="/mi-boda" />;
}
