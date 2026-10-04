import { ImageResponse } from "next/og";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { collares, diasHasta, hoyEnLima, nombreDeLaPareja, type Perla } from "@/lib/historia";
import { anillosUri } from "@/lib/icono-app";
import { fuenteGoogle } from "@/lib/fuente-og";
import { listarAcciones, listarDependencias, listarMetas, obtenerBoda } from "../../_acciones/datos";

export const runtime = "nodejs";

/**
 * Historia 9:16 para WhatsApp e Instagram (docs/compartir.md): la cuenta
 * regresiva y un collar de perlas por meta. Sin montos: lo que gastan es de
 * ellos. Lo de arriba y lo de abajo queda libre porque Instagram lo tapa.
 */
const VINO = "#49110b";
const LECHE = "#e7e5db";
const ARENA = "#ad9e89";
const MARMOL = "#c8c2b7";
const BOSQUE = "#56483b";

export async function GET() {
  const { orgId } = await auth();
  if (!orgId) return new Response("Sin boda activa", { status: 401 });

  const [acciones, dependencias, metas, boda, org] = await Promise.all([
    listarAcciones(),
    listarDependencias(),
    listarMetas(),
    obtenerBoda(),
    clerkClient().then((c) => c.organizations.getOrganization({ organizationId: orgId })).catch(() => null),
  ]);

  const dias = diasHasta(boda?.fecha ?? null, hoyEnLima());
  const lista = collares(acciones, dependencias, metas);
  const hechas = acciones.filter((a) => a.estado === "hecho").length;
  const pareja = nombreDeLaPareja(org?.name) || "Nuestra boda";

  const [numero, debajo] =
    dias === null
      ? [String(hechas), hechas === 1 ? "cosa lista para la boda" : "cosas listas para la boda"]
      : dias > 0
        ? [String(dias), dias === 1 ? "día para el sí" : "días para el sí"]
        : dias === 0
          ? ["Hoy", "es el sí"]
          : ["Sí", "ya nos casamos"];

  const pie = `${hechas} de ${acciones.length} cosas listas`;
  const textoSerif = `${pareja}${numero}${lista.map((c) => c.titulo).join("")}Casorio Club`;
  const textoSans = `${debajo}${pie}casorio-club.vercel.app0123456789 de`;
  const fuentes = (
    await Promise.all([fuenteGoogle("Fraunces", 400, textoSerif), fuenteGoogle("Instrument Sans", 500, textoSans)])
  ).filter((f) => f !== null);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          padding: "250px 96px 330px",
          color: LECHE,
          fontFamily: "Instrument Sans",
          background: `linear-gradient(170deg, #5e160e 0%, ${VINO} 45%, #2a0a06 100%)`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18, fontFamily: "Fraunces", fontSize: 40, color: ARENA }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={anillosUri} width={56} height={56} alt="" />
          Casorio Club
        </div>

        <div style={{ display: "flex", flexDirection: "column", marginTop: 110 }}>
          <div style={{ fontFamily: "Fraunces", fontSize: 54, color: MARMOL }}>{pareja}</div>
          <div style={{ fontFamily: "Fraunces", fontSize: numero.length > 3 ? 260 : 380, lineHeight: 0.9, letterSpacing: -12, marginTop: 10 }}>
            {numero}
          </div>
          <div style={{ fontSize: 56, color: MARMOL, marginTop: 18 }}>{debajo}</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 54, marginTop: "auto" }}>
          {lista.map((c) => (
            <div key={c.titulo} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <span style={{ fontFamily: "Fraunces", fontSize: 46 }}>{c.titulo}</span>
                <span style={{ fontSize: 34, color: ARENA }}>
                  {c.hechas} de {c.perlas.length}
                </span>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center" }}>
                {c.perlas.map((p, i) => (
                  <PerlaVista key={i} tipo={p} />
                ))}
              </div>
            </div>
          ))}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: 30,
              color: ARENA,
              borderTop: `2px solid ${BOSQUE}`,
              paddingTop: 28,
            }}
          >
            <span>{pie}</span>
            <span>casorio-club.vercel.app</span>
          </div>
        </div>
      </div>
    ),
    {
      width: 1080,
      height: 1920,
      fonts: fuentes,
      // Cambia cada vez que marcan algo: que el celular no guarde una vieja.
      headers: { "Cache-Control": "private, no-store" },
    },
  );
}

/** Una perla: llena si está hecha, a medias si va en curso, aro si falta; el hito, rombo. */
function PerlaVista({ tipo }: { tipo: Perla }) {
  const lado = 40;
  if (tipo === "hito" || tipo === "hito-hecho") {
    return (
      <div
        style={{
          width: lado - 8,
          height: lado - 8,
          margin: "0 6px",
          transform: "rotate(45deg)",
          background: tipo === "hito-hecho" ? LECHE : "transparent",
          border: `4px solid ${tipo === "hito-hecho" ? LECHE : ARENA}`,
        }}
      />
    );
  }
  return (
    <div
      style={{
        width: lado,
        height: lado,
        borderRadius: lado / 2,
        background: tipo === "hecha" ? LECHE : tipo === "haciendo" ? `linear-gradient(90deg, ${ARENA} 50%, transparent 50%)` : "transparent",
        border: `4px solid ${tipo === "hecha" ? LECHE : ARENA}`,
      }}
    />
  );
}
