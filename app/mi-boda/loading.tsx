/** Mientras llega la boda: la forma de la página, sin inventar contenido. */
export default function Cargando() {
  return (
    <main aria-busy="true" aria-label="Cargando" className="mx-auto w-full max-w-6xl flex-1 px-5 py-10 sm:px-10">
      <div className="bg-muted h-9 w-44 animate-pulse rounded-md motion-reduce:animate-none" />
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="bg-muted/60 h-64 animate-pulse rounded-lg motion-reduce:animate-none" />
        ))}
      </div>
    </main>
  );
}
