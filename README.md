# app-messages

Mensajes que la app de escritorio ConfAI muestra a los usuarios (plan caducado, cuota agotada, compra completada, avisos). Viven aquí, fuera del binario: editar un fichero en `main` cambia lo que ven todos los usuarios en la siguiente comprobación de la app, sin release y sin tocar telemetría ni billing.

La app los descarga en crudo desde:

```
https://raw.githubusercontent.com/GravitonAI-dev/app-messages/main/
```

## Cómo funciona

1. La app consulta el estado de la cuenta (telemetría `/api/user-usage` y billing `userInfo`) y construye un contexto con campos como `usage.payment_status` o `membership.days_left`.
2. Descarga `index.json` y cada `messages/<id>.json`.
3. Para cada mensaje evalúa su `when` contra el contexto. Los que cumplen se muestran, ordenados por `priority`.
4. Pinta cada uno con los componentes del design system de la app: los centrados son un `AppDialog` (título del JSON en la cabecera, X si se puede cerrar, el HTML como cuerpo, `AppButton` en el pie y `AppLink` a la izquierda del pie); los de esquina son un `AppBanner` (tono, icono, el HTML como texto y un botón pequeño). Blur, tamaño y posición los pone el envoltorio.

Regla fija de la app, no configurable desde aquí: si telemetría devuelve `payment_status: expired`, la app bloquea con blur siempre, aunque no consiga descargar nada. Dentro del blur pinta el mensaje bloqueante de mayor prioridad que cumpla su `when` (`trial_expired` o `plan_expired`) y, si no tiene ninguno, un mensaje embebido por defecto.

## Estructura

```
index.json                 qué mensajes existen y dónde están
messages/<id>.json         propiedades del contenedor + condición
messages/<id>.html         el contenido
templates/card.html        cuerpo de ejemplo con los patrones del design system de la app
assets/logo.png            logo de la app, referenciado desde el HTML
templates/tones.md         roles de color {{c.*}} (claro/oscuro), tonos y medidas del design system
schema/message.schema.json esquema del JSON de un mensaje
scripts/validate.mjs       validador (lo ejecuta la CI en cada push)
preview/index.html         vista previa: simula la app y pinta un mensaje en su contenedor
scripts/evaluate.mjs       evaluador de referencia: contexto → mensajes visibles (la app debe dar lo mismo)
fixtures/contexts/*.json   contextos de prueba con el resultado esperado (node scripts/test-fixtures.mjs)
```

## Crear un mensaje

1. Copia `templates/card.html` a `messages/<id>.html` y edita textos, color de acento y botones.
2. Crea `messages/<id>.json`:

```json
{
  "schema_version": 1,
  "id": "mi_mensaje",
  "enabled": true,
  "when": { "membership.plan_code": "free_plan", "membership.days_left": { "lte": 2 } },
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
4. `node scripts/validate.mjs` (o espera a la CI). En verde, merge a `main` y listo.

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
| `persistent` | `true`, `false` | `true`: vuelve a salir en cada comprobación mientras se cumpla `when`. `false`: una vez cerrado no vuelve |
| `auto_close` | segundos, `0` = no | Se cierra solo (solo con `dismissible: true`). Cuenta como cierre: con `persistent: false` no vuelve a salir |
| `priority` | 0-1000 | Si coinciden varios, el más alto primero. Si hay uno con blur visible, los demás esperan |
| `enabled` | `true`, `false` | Apagar un mensaje sin borrarlo |
| `title` | texto | Título en la cabecera del AppDialog. Opcional: sin él, el diálogo no tiene cabecera y el cuerpo lleva su propio encabezado |
| `tone` | `info`, `success`, `warning`, `danger` | Color e icono del AppBanner. Obligatorio en mensajes de esquina |
| `actions` | lista de 1 a 3 `{label, action, url?, variant}` | Botones del pie, de izquierda a derecha. El primario a la derecha |
| `footer_link` | `{label, action}` | Enlace a la izquierda del pie |

Un mensaje con blur y sin X debe ser `persistent: true`, llevar al menos un botón y no puede llevar un botón `dismiss`: solo se quita cuando deja de cumplirse su `when`.

## Condición `when`

Todas las claves deben cumplirse. Valor directo = igualdad; objeto = operadores `eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `in`, `exists`.

Campos del contexto que la app expone:

| Campo | Origen | Ejemplo |
|---|---|---|
| `usage.payment_status` | telemetría | `"paid"`, `"expired"` |
| `usage.usage_percentage` | telemetría | `87.5`, `null` si no hay métrica |
| `usage.has_constraints` | telemetría | `true` |
| `usage.used`, `usage.limit` | telemetría | tokens |
| `membership.payment_status` | billing | `"paid"` (billing no se entera del `expired`) |
| `membership.plan_code` | billing | `"free_plan"`, `"basic_plan"`, `"pro_plan"`, `"lex_pro_plan"` |
| `membership.plan_name` | billing | `"Trial"`, `"Confidential"` |
| `membership.created_at` | billing | ISO 8601 |
| `membership.max_days` | billing | `7`, `null` si el plan no caduca por días |
| `membership.expires_at` | calculado | `created_at + max_days`, ISO 8601 |
| `membership.days_left` | calculado | entero, negativo si ya pasó |
| `membership.hours_since_start` | calculado | horas desde `created_at` |
| `app.version`, `app.platform` | app | `"1.4.2"`, `"macos"` |

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

La app las sustituye antes de pintar, en el HTML y también en `title` y en las etiquetas de `actions` y `footer_link`: `{{user_name}}`, `{{plan_name}}` (plan actual), `{{plan_end_date}}`, `{{days_left}}`, `{{usage_percentage}}`, y el nombre comercial de cada plan tal como lo da billing (`getPlans` → `display_name`): `{{plan.basic_plan.name}}`, `{{plan.pro_plan.name}}`, `{{plan.lex_pro_plan.name}}`. Los nombres de plan nunca se escriben a mano.

Y los colores: `{{c.<rol>}}` se resuelve con `context.colors` del tema activo (claro u oscuro). Roles y valores en `templates/tones.md`. El validador rechaza colores fijos en `color`, `background` y `border`.

## Vista previa

Para ver un mensaje tal y como lo pintará la app (AppDialog o AppBanner, blur, posición, tamaño, tema claro u oscuro) sin compilar nada:

```
python3 -m http.server 8787
```

y abrir http://localhost:8787/preview/?m=trial_expired (añade `&theme=dark` para el tema oscuro). El desplegable cambia de mensaje; los botones `confai://` muestran la acción abajo a la izquierda en lugar de ejecutarla.

## Evaluador de referencia y fixtures

`scripts/evaluate.mjs` implementa la semántica exacta de `when`, `enabled`, `persistent`, cierres y prioridad. La app debe reproducirla. `fixtures/contexts/` tiene un contexto por situación (caducado, cuota agotada, compra reciente, trial a dos días, cuenta sana, sin métricas) con el resultado esperado; sirven como casos de test para la app.

```
node scripts/evaluate.mjs fixtures/contexts/expired.json
node scripts/test-fixtures.mjs
```

## Mensajes actuales

| id | Cuándo | Marco | Tono |
|---|---|---|---|
| `trial_expired` | telemetría dice `expired` y el plan era el Trial | AppDialog, blur, persistente, sin X; gana a `plan_expired` | brand |
| `plan_expired` | telemetría dice `expired` (plan de pago) | AppDialog, blur, persistente, sin X | danger |
| `quota_exhausted` | uso ≥ 100 % con plan vigente | AppDialog, sin blur, con X, vuelve mientras dure | warning |
| `purchase_success` | plan de pago con menos de 24 h | AppDialog, blur, con X, una sola vez | success |
| `trial_ending_soon` | trial con 2 días o menos | AppBanner abajo a la derecha, con X, se cierra a los 10 s | info |
