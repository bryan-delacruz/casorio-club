"use client";

import { useTransition } from "react";
import { Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

const ARCHIVO = "casorio-club-historia.png";

/**
 * Comparte la historia (app/mi-boda/compartir/historia). En el celular abre el
 * menú del sistema con la imagen, para mandarla a estados de WhatsApp o a
 * historias de Instagram; donde no se puede compartir archivos, la descarga.
 */
export function CompartirHistoria() {
  const [preparando, iniciar] = useTransition();

  return (
    <Button
      variant="outline"
      disabled={preparando}
      onClick={() =>
        iniciar(async () => {
          try {
            const res = await fetch("/mi-boda/compartir/historia", { cache: "no-store" });
            if (!res.ok) throw new Error(String(res.status));
            const archivo = new File([await res.blob()], ARCHIVO, { type: "image/png" });
            if (navigator.canShare?.({ files: [archivo] })) {
              await navigator.share({ files: [archivo] });
              return;
            }
            const url = URL.createObjectURL(archivo);
            const a = Object.assign(document.createElement("a"), { href: url, download: ARCHIVO });
            a.click();
            URL.revokeObjectURL(url);
            toast.success("Imagen descargada. Súbela a tu historia.");
          } catch (e) {
            // Cerrar el menú de compartir no es un error.
            if (e instanceof DOMException && e.name === "AbortError") return;
            toast.error("No se pudo preparar la imagen. Intenta otra vez.");
          }
        })
      }
    >
      <Share2 className="size-4" />
      {preparando ? "Preparando…" : "Compartir avance"}
    </Button>
  );
}
