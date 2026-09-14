import type { Metadata } from "next";
import { Fraunces, Instrument_Sans } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { shadcn } from "@clerk/ui/themes";
import { clerkLocalization } from "@/lib/clerk-localization";
import "./globals.css";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  axes: ["SOFT", "WONK", "opsz"],
});

const instrument = Instrument_Sans({
  variable: "--font-instrument",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Casorio Club",
    template: "%s · Casorio Club",
  },
  description:
    "Lleva los pendientes, trámites, compras y gastos de tu matrimonio civil en un solo lugar, junto a quien lo está organizando contigo.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`${fraunces.variable} ${instrument.variable} h-full`}
    >
      <body className="flex min-h-full flex-col">
        {/*
          El tema shadcn hace que Clerk lea los tokens de app/globals.css, que
          son la paleta de Casorio: si se cambia la marca, Clerk la sigue solo.
          Cero !important y cero CSS contra sus clases internas; los dos ajustes
          de abajo van por su API de appearance, que es la vía soportada.
        */}
        {/*
          Con membresía obligatoria, Clerk manda a todo usuario sin boda a la
          tarea "choose-organization". Aquí se aloja en /elegir-boda para que
          caiga dentro del diseño de la app y no en una pantalla suelta.
        */}
        <ClerkProvider
          localization={clerkLocalization}
          taskUrls={{ "choose-organization": "/elegir-boda" }}
          appearance={{
            theme: shadcn,
            // Dos ajustes, ambos por la API soportada de appearance:
            // 1. El tema usa --input (color de borde en shadcn) como relleno
            //    del campo, así que se le pasa el token propio --field.
            // 2. La flecha del botón no aporta nada: el texto ya dice qué pasa.
            variables: { colorInput: "var(--field)" },
            elements: { buttonArrowIcon: "hidden" },
          }}
        >
          {children}
        </ClerkProvider>
      </body>
    </html>
  );
}
