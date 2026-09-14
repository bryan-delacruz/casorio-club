import type { Metadata } from "next";
import { TaskChooseOrganization } from "@clerk/nextjs";

export const metadata: Metadata = { title: "Elige tu boda" };

/**
 * Aloja la tarea de sesión "choose-organization". Vive dentro de (auth) para
 * heredar el campo vino: es la última pantalla antes de entrar, y se lee como
 * parte del mismo trámite de acceso.
 */
export default function ElegirBodaPage() {
  return <TaskChooseOrganization redirectUrlComplete="/mi-boda" />;
}
