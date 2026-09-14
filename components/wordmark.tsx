/**
 * En superficies invertidas (bg-primary) se pasa tone="inverted" para que
 * la marca tome los tokens de primer plano de esa superficie.
 */
export function Wordmark({
  tone = "default",
  className = "",
}: {
  tone?: "default" | "inverted";
  className?: string;
}) {
  const invertido = tone === "inverted";
  return (
    <span
      className={`font-display text-[1.375rem] leading-none tracking-tight whitespace-nowrap ${
        invertido ? "text-primary-foreground" : "text-foreground"
      } ${className}`}
    >
      Casorio
      <span className={invertido ? "opacity-60" : "text-primary"}> Club</span>
    </span>
  );
}
