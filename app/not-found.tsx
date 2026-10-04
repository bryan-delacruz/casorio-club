import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NoEncontrada() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-start justify-center gap-5 px-6 py-20">
      <h1 className="font-display text-4xl">Esta página no existe</h1>
      <p className="text-muted-foreground">
        Puede que el enlace esté incompleto o que esa acción ya se haya borrado.
      </p>
      <Button asChild size="lg">
        <Link href="/mi-boda">Ir a mi boda</Link>
      </Button>
    </main>
  );
}
