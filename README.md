# app-messages

Mensajes que la app de escritorio ConfAI muestra a los usuarios (plan caducado, cuota agotada, compra completada, avisos). Viven aquí, fuera del binario: editar un fichero en `main` cambia lo que ven todos los usuarios en la siguiente comprobación de la app, sin release y sin tocar telemetría ni billing.

Los sirve el microservicio de `server/` (ver «Microservicio») en `https://messages.confai.app/raw/`, con las mismas rutas que el repo. Cada push a `main` publica una imagen nueva con el contenido dentro.

## Cómo funciona

La app no decide nada (ver `docs/codigos-de-estado.md`):

1. **Telemetría y el Gateway dicen qué ha pasado con códigos de estado.** Telemetría los da en `GET /api/user-usage/{uid}` → `status_codes` (p. ej. `PLAN_EXPIRED.DAYS_LIMIT_REACHED`); el Gateway, en sus errores (`INSUFFICIENT_CAPABILITY` + `constraintCode: max_days`, que la app lee como `GATEWAY.INSUFFICIENT_CAPABILITY.max_days`). Cada código trae sus datos en `params` (plan, fechas…).
2. **`codes.json` (este repo) dice qué hacer con cada código:** qué mensaje se enseña (puede depender de `params.plan_code`), con qué prioridad y si bloquea la app.
3. **La app busca sus códigos en `codes.json`, descarga los mensajes y los pinta** con los componentes del design system: los centrados son un `AppDialog` (título del JSON en la cabecera, X si se puede cerrar, el HTML como cuerpo, `AppButton` en el pie y `AppLink` a la izquierda del pie); los de esquina, un `AppBanner`. Si alguna entrada tiene `block: true`, pone el muro.

Sin conexión la app usa los últimos códigos y los ficheros que tiene en caché. Bloquear de verdad lo sigue haciendo el Gateway, que rechaza las peticiones de un plan caducado.

## Estructura

```
index.json                 qué mensajes existen y dónde están, y dónde está el catálogo
codes.json                 catálogo de códigos de estado: qué mensaje y si bloquea (ver «Códigos de estado»)
messages/<id>.json         propiedades del contenedor
messages/<id>.html         el contenido
home/<contenedor>.json     los dos contenedores fijos de la portada, en bloques (ver «Portada»)
templates/card.html        cuerpo de ejemplo con los patrones del design system de la app
assets/logo.png            logo de la app, referenciado desde el HTML
templates/tones.md         roles de color {{c.*}} (claro/oscuro), tonos y medidas del design system
schema/message.schema.json esquema del JSON de un mensaje
scripts/validate.mjs       validador (lo ejecuta la CI en cada push)
preview/index.html         vista previa: simula la app y pinta un mensaje en su contenedor
scripts/evaluate.mjs       evaluador de referencia: códigos → mensajes visibles y bloqueo (la app debe dar lo mismo)
fixtures/codes/*.json      códigos de prueba con el resultado esperado (node scripts/test-fixtures.mjs)
scripts/core/              el contrato: valores admitidos, variables y búsqueda en el catálogo
server/                    el microservicio (NestJS) que sirve el contenido
docs/codigos-de-estado.md  los códigos de estado: quién los emite, qué significan, qué falta
```

## Crear un mensaje

1. Copia `templates/card.html` a `messages/<id>.html` y edita textos, color de acento y botones.
2. Crea `messages/<id>.json`:

```json
{
  "schema_version": 1,
  "id": "mi_mensaje",
  "enabled": true,
  "size": "md",
  "position": "center",
  "backdrop": "none",
  "dismissible": true,
  "persistent": false,
  "auto_close": 0,
  "priority": 30,
  "html_file": "mi_mensaje.html"
}
```

3. Añádelo a `index.json`: `"mi_mensaje": "messages/mi_mensaje.json"`.
4. Dile a `codes.json` con qué código sale (ver «Códigos de estado»).
5. `node scripts/validate.mjs` (o espera a la CI). En verde, merge a `main` y listo.

## Portada

Además de los mensajes, la pantalla de inicio tiene dos contenedores **fijos**: no dependen de la cuenta ni de ningún código. Se declaran en `index.json` bajo `home`:

```json
"home": {
  "portada_centro":  "home/portada_centro.json",
  "portada_derecha": "home/portada_derecha.json"
}
```

| Contenedor | Dónde |
|---|---|
| `portada_centro` | La columna central entera, marca incluida. |
| `portada_derecha` | El panel lateral derecho. Con `enabled: false` desaparece también la columna. |

Cada contenedor es `{ "schema_version": 1, "enabled": true, "blocks": [ … ] }`. Los bloques se pintan **en el orden de la lista**; se reordenan, quitan o duplican moviendo líneas, y cada uno admite su propio `enabled: false`. Cualquier tipo vale en cualquiera de los dos contenedores.

| `type` | Campos | Qué pinta |
|---|---|---|
| `brand` | — | La marca de la app (escudo + ConfAI). El logo es del binario; aquí sólo se decide si sale y dónde |
| `label` | `text` | Etiqueta pequeña en mayúsculas, color de marca |
| `headline` | `text` (admite `\n`) | El titular grande |
| `text` | `text`, `title` opcional | Párrafo de texto; con `title`, un título encima |
| `actions` | `items`: `label`, `action`, `variant` (`primary`/`secondary`), `icon` | Fila de botones. `action`: `new_chat` (chat nuevo), `upload_document` y `transcribe_audio` (diálogo «Abrir en editor» en un chat nuevo), `create_client` (diálogo «Nuevo cliente», con extracción desde PDF), `checkout`, `url` (con `url` https) |
| `features` | `items` (1 a 8): `number`, `title`, `subtitle` | Argumentos numerados bajo una raya, en 4, 2 o 1 columnas según el ancho |
| `legal` | `text` con huecos `{nombre}`, `links.<nombre>`: `label`, `url` https | Aviso legal con cada hueco como enlace |
| `news` | `title`, `label` e `intro` opcionales, `sections`: `title`, `items` | Secciones plegables; el «N cambios» lo cuenta la app |
| `banner` | `text`, `icon`, `tone` (`info`, `success`, `warning`, `danger`) | Franja destacada |

Reglas:

- Cada texto es un objeto por idioma: `{ "es": "…", "en": "…" }`. `es` es obligatorio; si falta el idioma del usuario se usa `es`.
- Manda el repo: si trae el contenedor, lo que no esté en `blocks` no se pinta. Si el fichero no se puede descargar y no hay caché, la app enseña su portada embebida (la de antes de existir este repo). Si está en caché, enseña la caché.
- Los iconos admitidos son nombres del catálogo de la app: `add`, `upload`, `audio`, `lock`, `info`, `shield`, `sparkle`, `documents`, `chat`, `check`, `alert`, `book`, `mail`, `openExternal`, `newChat`, `library`, `clients`, `skills`, `templates`.

## Renderizado fijo

Un mensaje se ve exactamente igual que en `preview/` en cualquier ventana o monitor. La app maqueta el contenido al ancho fijo del mensaje (`size`), con fuente base fija, y si la ventana es más pequeña escala el diálogo entero hacia abajo; nunca recoloca el contenido. Si el alto no cabe, scroll interno.

## Qué va en el JSON y qué en el HTML

| En el JSON (lo pinta el design system) | En el HTML (cuerpo) |
|---|---|
| `title`: título del AppDialog (opcional) | párrafos, negritas, panel de datos (tabla), tile del icono, encabezado del cuerpo |
| `actions`: 1 a 3 botones `{label, action, url?, variant}` → AppButton (`primary`, `secondary`, `ghost`, `danger`) | ningún botón ni enlace `confai://` |
| `footer_link`: `{label, action}` → AppLink a la izquierda del pie | colores solo como `{{c.<rol>}}` |
| `tone` (`info`, `success`, `warning`, `danger`): solo en mensajes de esquina (AppBanner) | |

## Campos del contenedor

| Campo | Valores | Qué hace |
|---|---|---|
| `size` | `sm`, `md`, `lg` o un ancho en px (240-1200) | Ancho de la caja |
| `position` | `center`, `top`, `bottom`, `top-right`, `bottom-right` | Dónde se coloca |
| `backdrop` | `blur`, `none` | Con blur la app queda tapada y no se puede usar detrás |
| `dismissible` | `true`, `false` | Si tiene X y se puede cerrar |
| `persistent` | `true`, `false` | `true`: vuelve a salir en cada comprobación mientras siga llegando su código. `false`: una vez cerrado no vuelve |
| `auto_close` | segundos, `0` = no | Se cierra solo (solo con `dismissible: true`). Cuenta como cierre: con `persistent: false` no vuelve a salir |
| `priority` | 0-1000 | Sin uso: el orden lo pone la `priority` de la entrada de `codes.json` |
| `enabled` | `true`, `false` | Apagar un mensaje sin borrarlo |
| `title` | texto | Título en la cabecera del AppDialog. Opcional: sin él, el diálogo no tiene cabecera y el cuerpo lleva su propio encabezado |
| `tone` | `info`, `success`, `warning`, `danger` | Color e icono del AppBanner. Obligatorio en mensajes de esquina |
| `actions` | lista de 1 a 3 `{label, action, url?, variant}` | Botones del pie, de izquierda a derecha. El primario a la derecha |
| `footer_link` | `{label, action}` | Enlace a la izquierda del pie |

Un mensaje con blur y sin X debe ser `persistent: true`, llevar al menos un botón y no puede llevar un botón `dismiss`: solo se quita cuando deja de llegar su código.

## Códigos de estado (`codes.json`)

Para cada código, qué mensaje sale, en qué orden y si bloquea. Los códigos, quién los emite y sus `params` están en `docs/codigos-de-estado.md`.

```json
{
  "schema_version": 1,
  "codes": {
    "PLAN_EXPIRED.DAYS_LIMIT_REACHED":          { "priority": 110, "block": true, "message": { "free_plan": "trial_expired", "*": "subscription_expired" } },
    "PLAN_REVOKED":                             { "priority": 105, "block": true, "message": "payment_failed" },
    "GATEWAY.INSUFFICIENT_CAPABILITY.max_days": { "priority": 100, "block": true, "recheck": true, "message": "plan_expired" },
    "PLAN_EXPIRING_SOON":                       { "priority": 20,  "block": false, "message": { "free_plan": "trial_ending_soon" } }
  },
  "fallback": null
}
```

| Campo | Qué es |
|---|---|
| `message` | El id de un mensaje de `index.json`, o un objeto por `params.plan_code` con `*` por defecto. Sin variante para el plan, el código no enseña nada |
| `block` | `true`: la app queda tapada mientras llegue el código |
| `priority` | Si llegan varios, el mayor primero; con uno que bloquea, el resto espera. Si dos códigos llevan al mismo mensaje, cuenta el de más prioridad |
| `recheck` | Al recibirlo la app vuelve a preguntar a telemetría. El Gateway no sabe el plan; telemetría contesta enseguida con `PLAN_EXPIRED` (110), que gana a este (100) con el mensaje de su plan |
| `X.*` | Comodín: cualquier motivo de esa situación. Gana la clave exacta |
| `fallback` | Qué hacer con un código desconocido: `null` = nada |

Hoy cubre el plan caducado por fecha, el trial a punto de acabar y la suscripción impagada. La cuota (`QUOTA_EXHAUSTED.*`) llegará con la ventana de tokens. Cancelar una suscripción no tiene código propio: el plan sigue hasta su fecha (ver `docs/codigos-de-estado.md`, «Cancelación»).

## HTML admitido

Etiquetas: `div p h1 h2 h3 span strong em a img table tr td ul li br hr`.
Atributos: `style href src alt width height`.
Estilos en línea: `color background background-color font-size font-weight font-family line-height text-align text-decoration border border-top border-bottom border-left border-right border-radius margin padding width max-width height display opacity letter-spacing`.

Sin `<script>`, sin `<style>`, sin `on*=`, sin flex ni grid, sin CSS externo. Las imágenes solo por `https://`.

## Acciones

Van en `actions` y `footer_link` del JSON, nunca como enlaces en el HTML:

| action | Qué hace |
|---|---|
| `checkout` | Abre la web en Suscripción (`/dashboard/subscription`, planes de pago) con la sesión del usuario. `plan` e `interval` opcionales llevan al checkout del plan, pero HOY el handoff de billing solo admite rutas `/dashboard/...` sin query: hasta que billing (`web-handoff.ts`) y la web (`lib/safeNext.js`) acepten `/checkout?plan=…`, no los uses |
| `url` (+ `url`) | Abre la URL https en el navegador. Si es de `confidentialai.es/dashboard/...` (sin query) se abre con la sesión del usuario (handoff); cualquier otra, sin sesión |
| `recheck` | Vuelve a comprobar el estado de la cuenta ahora |
| `dismiss` | Cierra el mensaje |
| `signout` | Cierra la sesión |

En el HTML solo se admiten enlaces `https://` normales dentro del texto.

## Variables

La app las sustituye antes de pintar, en el HTML y también en `title` y en las etiquetas de `actions` y `footer_link`. En el HTML los valores van escapados. Lo que no se conoce sale como «—».

| Variable | Qué es |
|---|---|
| `{{user_name}}`, `{{user.name}}` | Nombre del usuario (billing y, si no hay, el de la sesión) |
| `{{plan_name}}` | Nombre del plan actual |
| `{{plan.<código>.name}}` | Nombre comercial de un plan según billing (`getPlans` → `display_name`): `plan.basic_plan.name`, `plan.pro_plan.name`, `plan.lex_pro_plan.name`. Los nombres de plan nunca se escriben a mano |
| `{{params.<clave>}}` | Un dato del código que trajo el mensaje, tal cual (p. ej. `{{params.max_days}}`) |
| `{{plan_end_date}}` | `params.expires_at` como fecha larga: «9 de octubre de 2026» |
| `{{days_left}}` | `params.days_left` |
| `{{usage_percentage}}` | `params.usage_percentage`, redondeado |
| `{{usage_reset}}`, `{{usage_since}}` | Cuándo se renueva la cuota y desde cuándo cuenta. Pendientes de la ventana de tokens: hoy, texto genérico |

Los filtros (`{{x | date}}`) están reservados: la app aún no los entiende y el validador los rechaza.

Y los colores: `{{c.<rol>}}` sólo en el HTML. Los resuelve la app con `context.colors` del tema activo (claro u oscuro). Roles y valores en `templates/tones.md`. El validador rechaza colores fijos en `color`, `background` y `border`.

## Microservicio

`server/` es un NestJS que carga en memoria el contenido del repo (el de la imagen) y lo sirve. No evalúa nada: eso lo hace la app con `codes.json`.

| Endpoint | Qué devuelve |
|---|---|
| `GET /health` | `{status, content_version}` |
| `GET /raw/<ruta>` | El fichero del repo tal cual (`/raw/index.json`, `/raw/codes.json`, `/raw/messages/…`, `/raw/assets/…`), con `ETag`/`304` |
| `GET /v1/home?lang=es` | Los contenedores de la portada con los textos ya en el idioma pedido (si falta, `es`) |
| `POST /internal/reload` | Con `X-Reload-Token`: vuelve a leer el contenido del disco. Sin `RELOAD_TOKEN` no existe. Si algo no se entiende, sigue sirviendo lo anterior |
| `GET /preview/` | La vista previa (redirige a `/raw/preview/`) |

En local:

```
cd server && pnpm install && pnpm test
pnpm start:dev                                  # http://localhost:3000, contenido de ..
docker compose up --build                       # igual, en contenedor (necesita server/.env)
```

Despliegue: `.github/workflows/deploy.yml` valida, publica `ghcr.io/gravitonai-dev/app-messages` y hace `docker compose pull && up -d` en el VPS por SSH. La configuración está en `server/.env.example`.

## Vista previa

Para ver un mensaje tal y como lo pintará la app (AppDialog o AppBanner, blur, posición, tamaño, tema claro u oscuro) sin compilar nada (o en `/preview/` del servicio):

```
python3 -m http.server 8787
```

y abrir http://localhost:8787/preview/?m=trial_expired (añade `&theme=dark` para el tema oscuro). El desplegable cambia de mensaje; los botones `confai://` muestran la acción abajo a la izquierda en lugar de ejecutarla.

## Evaluador de referencia y fixtures

`scripts/core/evaluate.mjs` implementa la búsqueda en `codes.json`: clave exacta, comodín, `fallback`, variante por plan, prioridad, cierres y bloqueo. La app debe reproducirla. `fixtures/codes/` tiene un caso por situación (trial caducado, trial a dos días, rechazo del Gateway, código desconocido…) con el resultado esperado; sirven como casos de test para la app.

```
node scripts/evaluate.mjs fixtures/codes/trial_expired.json
node scripts/test-fixtures.mjs
```

## Mensajes actuales

| id | Con qué código (`codes.json`) | Marco | Tono |
|---|---|---|---|
| `trial_expired` | `PLAN_EXPIRED.DAYS_LIMIT_REACHED` con `plan_code: free_plan` | AppDialog, blur, persistente, sin X | brand |
| `subscription_expired` | `PLAN_EXPIRED.DAYS_LIMIT_REACHED` con otro plan | AppDialog, blur, persistente, sin X; mismo diseño que `trial_expired` | brand |
| `plan_expired` | `GATEWAY.INSUFFICIENT_CAPABILITY.max_days`, hasta que telemetría confirma el plan | AppDialog, blur, persistente, sin X | danger |
| `payment_failed` | `PLAN_REVOKED`: suscripción impagada (Stripe la terminó) sin otro plan ni trial en vigor | AppDialog, blur, persistente, sin X; «Ya lo he pagado» y «Revisar el pago» | danger |
| `trial_ending_soon` | `PLAN_EXPIRING_SOON` con `plan_code: free_plan` | AppBanner abajo a la derecha, con X, se cierra a los 10 s | info |
| `quota_exhausted` | Ninguno todavía: llegará con la ventana de tokens | AppDialog abajo centrado, encima del cuadro de entrada del chat; sin blur, con X | danger |
| `purchase_success` | Ninguno todavía (`PLAN_STARTED`, pendiente) | AppDialog, blur, con X, una sola vez | success |
