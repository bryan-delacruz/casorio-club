"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

/** Errores inesperados de cualquier página. El mensaje real queda en el log. */
export default function ErrorDePagina({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-start justify-center gap-5 px-6 py-20">
      <h1 className="font-display text-4xl">Algo se cruzó en el camino</h1>
      <p className="text-muted-foreground">
        No pudimos cargar esta parte. Lo que ya guardaste está a salvo; vuelve a intentarlo.
      </p>
      <Button size="lg" onClick={() => retry()}>
        Intentar de nuevo
      </Button>
      {error.digest && <p className="text-muted-foreground text-xs">Código: {error.digest}</p>}
    </main>
  );
}
