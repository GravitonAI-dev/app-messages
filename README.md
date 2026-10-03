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
4. Pinta cada uno en su contenedor (tamaño, posición, blur, X) con el HTML de `messages/<id>.html` dentro, sustituyendo las variables.

Regla fija de la app, no configurable desde aquí: si telemetría devuelve `payment_status: expired`, la app bloquea con blur siempre, aunque no consiga descargar nada. Dentro del blur pinta `plan_expired` si lo tiene, y si no, un mensaje embebido por defecto.

## Estructura

```
index.json                 qué mensajes existen y dónde están
messages/<id>.json         propiedades del contenedor + condición
messages/<id>.html         el contenido
templates/card.html        tarjeta base con el estilo de los correos de ConfAI
templates/tones.md         colores de cada tono (rojo, ámbar, azul, verde, morado, gris)
schema/message.schema.json esquema del JSON de un mensaje
scripts/validate.mjs       validador (lo ejecuta la CI en cada push)
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

## Campos del contenedor

| Campo | Valores | Qué hace |
|---|---|---|
| `size` | `sm`, `md`, `lg` o un ancho en px (240-1200) | Ancho de la caja |
| `position` | `center`, `top`, `bottom`, `top-right`, `bottom-right` | Dónde se coloca |
| `backdrop` | `blur`, `none` | Con blur la app queda tapada y no se puede usar detrás |
| `dismissible` | `true`, `false` | Si tiene X y se puede cerrar |
| `persistent` | `true`, `false` | `true`: vuelve a salir en cada comprobación mientras se cumpla `when`. `false`: una vez cerrado no vuelve |
| `auto_close` | segundos, `0` = no | Se cierra solo (solo con `dismissible: true`) |
| `priority` | 0-1000 | Si coinciden varios, el más alto primero. Si hay uno con blur visible, los demás esperan |
| `enabled` | `true`, `false` | Apagar un mensaje sin borrarlo |

Un mensaje con blur y sin X debe ser `persistent: true`.

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

## Botones

Un botón es un enlace con esquema propio:

| href | Acción |
|---|---|
| `confai://checkout` | Abre la web de suscripción con la sesión del usuario |
| `confai://url?u=<url https codificada>` | Abre la URL en el navegador |
| `confai://recheck` | Vuelve a comprobar el estado de la cuenta ahora |
| `confai://dismiss` | Cierra el mensaje |
| `confai://signout` | Cierra la sesión |

Un `https://` normal también abre el navegador.

## Variables

La app las sustituye antes de pintar: `{{user_name}}`, `{{plan_name}}`, `{{plan_end_date}}`, `{{days_left}}`, `{{usage_percentage}}`.

## Evaluador de referencia y fixtures

`scripts/evaluate.mjs` implementa la semántica exacta de `when`, `enabled`, `persistent`, cierres y prioridad. La app debe reproducirla. `fixtures/contexts/` tiene un contexto por situación (caducado, cuota agotada, compra reciente, trial a dos días, cuenta sana, sin métricas) con el resultado esperado; sirven como casos de test para la app.

```
node scripts/evaluate.mjs fixtures/contexts/expired.json
node scripts/test-fixtures.mjs
```

## Mensajes actuales

| id | Cuándo | Marco | Tono |
|---|---|---|---|
| `plan_expired` | telemetría dice `expired` | centro, blur, persistente, sin X | rojo |
| `quota_exhausted` | uso ≥ 100 % con plan vigente | centro, sin blur, con X, vuelve mientras dure | ámbar |
| `purchase_success` | plan de pago con menos de 24 h | centro, blur, con X, una sola vez | morado |
| `trial_ending_soon` | trial con 2 días o menos | abajo derecha, sin blur, con X, se cierra a los 10 s | azul |
