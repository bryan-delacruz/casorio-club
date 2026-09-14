import { Check } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";

/**
 * Un expediente matrimonial a medio llenar. Es contenido de ejemplo, pero los
 * requisitos son los reales de una municipalidad peruana: enseñar el trámite
 * convence más que describirlo.
 */
const requisitos: { texto: string; listo: boolean; responde?: string }[] = [
  { texto: "Partida de nacimiento de los dos", listo: true, responde: "Ana" },
  { texto: "Copia del DNI de los dos", listo: true, responde: "Luis" },
  { texto: "Certificado domiciliario", listo: true, responde: "Ana" },
  { texto: "Certificado médico prenupcial", listo: false, responde: "los dos" },
  { texto: "Declaración jurada de soltería", listo: false },
  { texto: "Dos testigos con su DNI", listo: false, responde: "Luis" },
  { texto: "Publicación del edicto matrimonial", listo: false },
  { texto: "Pago de la tasa municipal", listo: false, responde: "Ana" },
  { texto: "Reserva de fecha y hora", listo: false },
];

const listos = requisitos.filter((r) => r.listo).length;
const avance = Math.round((listos / requisitos.length) * 100);

export function Expediente() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display text-lg font-normal">
          Expediente para la municipalidad
        </CardTitle>
        <CardDescription>
          {listos} de {requisitos.length} listos
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        <Progress
          value={avance}
          aria-label={`${listos} de ${requisitos.length} requisitos listos`}
        />

        <ul className="space-y-3">
          {requisitos.map(({ texto, listo, responde }) => (
            <li key={texto} className="flex items-start gap-3">
              {listo ? (
                <Check
                  aria-hidden
                  className="text-primary mt-0.5 size-4 shrink-0"
                  strokeWidth={2.5}
                />
              ) : (
                <span
                  aria-hidden
                  className="border-muted-foreground/45 mt-0.5 size-4 shrink-0 rounded-full border"
                />
              )}
              <span
                className={`text-[0.9375rem] leading-5 ${
                  listo
                    ? "text-muted-foreground/70 line-through"
                    : "text-foreground"
                }`}
              >
                {texto}
              </span>
              {responde && !listo && (
                <span className="text-muted-foreground/70 ml-auto shrink-0 pl-3 text-sm">
                  {responde}
                </span>
              )}
            </li>
          ))}
        </ul>
      </CardContent>

      <Separator />

      <CardFooter>
        <p className="text-muted-foreground text-sm">
          La ceremonia es el 12 de noviembre.
        </p>
      </CardFooter>
    </Card>
  );
}
