import type { Metadata } from "next";
import { SignIn } from "@clerk/nextjs";

export const metadata: Metadata = { title: "Entrar" };

export default function EntrarPage() {
  return <SignIn signUpUrl="/crear-cuenta" forceRedirectUrl="/mi-boda" />;
}
