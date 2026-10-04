# Integración con Bernie Wallet

> **Spec (SDD).** Este documento manda sobre el código de la integración: si algo
> cambia, primero se actualiza aquí. **Estado: aprobada e implementada.**
> Contrato del lado proveedor: `SPEC.md` §15 y `docs/api/openapi.json` en el repo
> de Bernie Wallet. Diseñada lista para producción.

## 1. Objetivo

Traer a la boda los gastos que el usuario ya tiene en **Bernie Wallet** (las
categorías que elija, ej. "Matrimonio") sin escribirlos dos veces. Se conecta con
**"Conectar con Bernie Wallet"** (OAuth 2.1 + PKCE) y después se mantiene al día
sola: webhook de aviso + sincronización incremental por cursor.

Solo lectura: Casorio nunca modifica nada en Bernie.

## 2. Estándares

| Área | Estándar | En Casorio |
|---|---|---|
| Autorización | OAuth 2.1, RFC 9700, PKCE S256 | Cliente confidencial; `state` + `code_verifier` en cookie httpOnly; redirect URI exacta |
| Tokens | — | Refresh token **cifrado AES-256-GCM**; access token solo en memoria (dura 1 h); rotación sin carreras |
| Sincronización | Cursor incremental (`added/modified/removed`) | Upserts idempotentes; maneja `cursor_reset` |
| Webhooks | Standard Webhooks | Verifica firma y timestamp, deduplica por `webhook-id` |
| Errores | RFC 9457 | Lee `code` del Problem Details; respeta `Retry-After` en `429` |
| Contrato | OpenAPI 3.1 de Bernie | Validador propio (`lib/bernie/contrato.ts`, sin dependencias) probado contra los ejemplos del OpenAPI (test de contrato) |

## 3. Cómo encaja con el modelo

| Bernie | Casorio |
|---|---|
| Gasto (`expense`) | **Pago** (`pagos`) de una acción |
| Subcategoría (ej. "Fotógrafo") | Sugerencia de **acción** con ese título |

`pagos.accion_id` es obligatorio y un gasto del banco no sabe a qué acción
pertenece. Por eso los gastos importados llegan a una **bandeja "Por asignar"** y
el usuario los asigna, crea una acción con ellos o los descarta.

## 4. Modelo de datos (Drizzle, migración nueva)

`conexiones_bernie` — una por boda.
- `boda_id` text PK (orgId de Clerk)
- `conectada_por_id` text — userId de Clerk de quien autorizó
- `bernie_user_id` uuid — `sub` del token; así se enruta un webhook a su boda. Índice.
- `refresh_token` text — cifrado AES-256-GCM (`node:crypto`), nunca en claro
- `cursor` text null — último `nextCursor` de Bernie
- `estado` enum `activa | revocada | error`
- `sincronizando_hasta` timestamptz null — lease: una sola sync por boda a la vez (webhook, botón y bandeja pueden coincidir)
- `ultima_sync_el`, `ultimo_error` text null, `creada_el`

`gastos_bernie` — la bandeja.
- `id` uuid PK, `boda_id` text
- `externo_id` uuid — id en Bernie. **Único `(boda_id, externo_id)`**.
- `fecha` date, `monto` numeric(12,2), `moneda` text, `comercio` text, `subcategoria` text null
- `pago_id` uuid null → `pagos.id` (on delete set null). Con valor = asignado.
- `descartado` bool, `fuera_de_bernie` bool — ya no está en Bernie (ver 6.3)
- índice `(boda_id, pago_id)`

`webhooks_recibidos` — idempotencia.
- `webhook_id` text PK, `recibido_el`. Se purgan a los 7 días.

`pagos` **no cambia**: el badge "de Bernie" se deriva de `gastos_bernie.pago_id`. Así Casorio se despliega antes de crear las tablas de la integración sin romper nada.

## 5. Conexión

1. `GET /api/bernie/conectar` (miembro autenticado; no disponible en la boda demo):
   genera `state` y `code_verifier`, los guarda en cookie **httpOnly, Secure,
   SameSite=Lax, 10 min, ligada al `orgId`**, y redirige a
   `{BERNIE_SUPABASE_URL}/auth/v1/oauth/authorize` con `response_type=code`,
   `client_id`, `redirect_uri`, `code_challenge` (S256), `state`, `scope=email`.
2. El usuario aprueba en Bernie y elige categorías.
3. `GET /api/bernie/callback`: valida `state` y `orgId` contra la cookie, canjea el
   código en `/oauth/token` (`client_secret_basic` + `code_verifier`), valida el
   access token (`iss`, `exp`, `client_id` propio), guarda `sub` y el refresh token
   cifrado, borra la cookie, hace la sincronización inicial y redirige a la bandeja.
4. `error=access_denied` → toast "No se conectó". Cualquier otro error → mensaje
   genérico (sin filtrar detalles del proveedor).

## 6. Sincronización

### 6.1 `sincronizarBernie(bodaId)`
1. Refresca el access token. **Rotación:** el refresh token nuevo se guarda con
   `UPDATE … WHERE refresh_token = <anterior>`; si no actualiza filas, otra sync ganó
   → se aborta sin error.
2. Llama `GET /api/v1/shared-expenses/sync?cursor=…` en bucle mientras `hasMore`.
3. Aplica cada página **en una transacción** junto con el cursor nuevo: si algo
   falla, el cursor no avanza y la siguiente sync repite (los upserts son idempotentes).
4. `409 cursor_reset` → borra el cursor y repite desde cero.
5. `429` → respeta `Retry-After`. `401`/`invalid_grant` → `estado = revocada`.
   Otros errores → `estado = error` con `ultimo_error`, reintento en la siguiente.

### 6.2 Cuándo corre
- **Webhook** `expenses.sync_available` (casi en tiempo real).
- Al abrir la bandeja si `ultima_sync_el` > 1 h (red de seguridad si se pierde un webhook).
- Botón **Sincronizar**.

### 6.3 Cómo aplica cada cambio
- `added` → entra a la bandeja.
- `modified` → actualiza la bandeja; si está asignado, actualiza también el pago
  (**Bernie es la fuente de verdad del monto y la fecha**).
- `removed` → sin asignar: se borra; **asignado: se conserva** con
  `fuera_de_bernie = true` y aviso "Ya no está en Bernie" para que el usuario decida.

## 7. Webhooks entrantes

`POST /api/webhooks/bernie`:
1. Verifica la firma Standard Webhooks con `BERNIE_WEBHOOK_SECRET`
   (comparación en tiempo constante) y rechaza timestamps fuera de **±5 min**.
2. Si `webhook-id` ya está en `webhooks_recibidos` → `200` sin hacer nada.
3. Responde `200` de inmediato y procesa con `after()`:
   - `expenses.sync_available` → busca la conexión por `bernie_user_id` → sincroniza.
   - `grant.revoked` → `estado = revocada`.

`POST /api/webhooks/clerk` (verificado con `verifyWebhook` de Clerk):
- `organizationMembership.deleted` y `conectada_por_id` es ese usuario → **desconecta**
  (7.1): sus gastos no deben seguir entrando a una boda de la que salió.
- `organization.deleted` → desconecta y borra los datos de la integración.

### 7.1 Desconectar
`POST {BERNIE_URL}/api/v1/connection/revoke` con el access token (revoca en
Bernie), luego borra token y cursor, `estado = revocada`. Los pagos ya asignados se
conservan. Si Bernie no responde, se borra igual localmente y se avisa al usuario
que revise Apps conectadas en Bernie.

## 8. UI

- **Página `/mi-boda/bernie`** (enlace "Gastos de Bernie" con contador en la cabecera; oculto en la demo o sin configurar). **Bandeja "Por asignar"**: fecha, comercio, monto, subcategoría.
  Acciones: **Asignar a acción** (combobox; preselecciona la acción cuyo título
  coincida con la subcategoría, sin distinguir mayúsculas ni tildes), **Crear
  acción**, **Descartar**. Contador en la navegación.
- Asignar crea el pago con `monto`, `fecha`, `nota = comercio`,
  `pagado_por_id = conectada_por_id`.
- **Ajustes de la boda → Bernie Wallet:** estado, quién conectó, última sync, último
  error, **Sincronizar**, **Desconectar**.
- Badge "de Bernie" en los pagos enlazados desde `gastos_bernie` (solo si la integración está configurada).
- Teclado y lector de pantalla: todo operable sin arrastrar (igual que el tablero).

## 9. Seguridad y privacidad

- Toda acción verifica membresía de la boda (`auth.protect()` + `orgId`).
- Secretos solo en variables de servidor; tokens nunca en logs ni en el cliente.
- Logs estructurados sin montos ni comercios.
- Solo se reciben fecha, monto, moneda, comercio y subcategoría (lo define Bernie).
- **Demo:** integración oculta en la boda demo.

## 10. Pruebas

- **Contrato:** `validarPagina` validado contra los ejemplos
  del `openapi.json` de Bernie (copiados como fixtures, con su versión).
- Verificación de webhooks contra los vectores de prueba de Standard Webhooks.
- Aplicar cambios: `added/modified/removed`, asignados vs. sin asignar, `cursor_reset`.
- PKCE: `code_challenge` = S256 del verificador; `state` distinto → error.

## 11. Variables de entorno

| Variable | Uso |
|---|---|
| `BERNIE_URL` | Origen de Bernie (API v1) |
| `BERNIE_SUPABASE_URL` | Proyecto Supabase de Bernie (authorize / token) |
| `BERNIE_OAUTH_CLIENT_ID` | Cliente OAuth registrado en Bernie |
| `BERNIE_OAUTH_CLIENT_SECRET` | Secret del cliente |
| `BERNIE_WEBHOOK_SECRET` | Verificar webhooks de Bernie |
| `BERNIE_TOKEN_ENCRYPTION_KEY` | AES-256-GCM, 32 bytes base64 |
| `CLERK_WEBHOOK_SIGNING_SECRET` | Verificar webhooks de Clerk |

## 12. Orden de implementación (un PR por paso)

1. **Bernie — datos:** migración 0009 (tablas, triggers, políticas restrictivas,
   `shared_expense_changes`) + pruebas SQL.
2. **Bernie — API:** OpenAPI, `/sync`, `/connection/revoke`, Problem Details, rate limit.
3. **Bernie — UI:** `next` en login, `/oauth/consent`, Apps conectadas, `/privacy`.
4. **Bernie — webhooks:** outbox, firma, entrega (`after()` + pg_cron).
5. **Configuración manual** (Bernie §15.9).
6. **Casorio — conexión:** migración, cifrado, `/conectar`, `/callback`, desconectar.
7. **Casorio — sync:** `sincronizarBernie`, bandeja, ajustes.
8. **Casorio — webhooks:** Bernie y Clerk.
9. **Prueba de punta a punta** en local y producción.

## 13. Pruebas automáticas

`pnpm test` (node:test, sin dependencias): cifrado, PKCE (vector del RFC 7636),
firma de webhooks (vector oficial de Standard Webhooks), contrato contra los
ejemplos del OpenAPI de Bernie (`lib/bernie/fixtures/contrato-v1.json`) y el plan
de cambios (`added/modified/removed`, asignados vs. sin asignar, fecha en Lima).

## 14. Puesta en marcha

1. Variables de §11 en Vercel y `.env.local`.
2. Esquema: `pnpm dlx dotenv-cli -e .env.local -- pnpm drizzle-kit push` (tablas
   `conexiones_bernie`, `gastos_bernie` y `webhooks_recibidos`; no modifica tablas existentes).
3. Clerk → Webhooks: endpoint `https://casorio-club.vercel.app/api/webhooks/clerk` con
   `organizationMembership.deleted` y `organization.deleted`; su signing secret en
   `CLERK_WEBHOOK_SIGNING_SECRET`.
4. En Bernie: SPEC §15.9.
