# Códigos de estado: telemetría, Gateway y app-messages

**Estado:** en implementación: `PLAN_EXPIRED.DAYS_LIMIT_REACHED`, `PLAN_EXPIRING_SOON`, `PLAN_REVOKED`, `NO_PLAN`, `QUOTA_EXHAUSTED.*` y, de la Gateway, `GATEWAY.INSUFFICIENT_CAPABILITY.max_days` (también como `USAGE_LIMIT_EXCEEDED.max_days`), `GATEWAY.USAGE_LIMIT_EXCEEDED.*` y `GATEWAY.TOKEN_LIMIT_EXCEEDED`. Cuándo se renueva la cuota (`resets_at`) sigue pendiente (§6). El catálogo vigente es `codes.json`; el ejemplo del §4 es el catálogo completo al que se quiere llegar.

## Por qué

La app tiene que saber qué mensaje enseñar y si debe bloquear: plan caducado, cuota agotada, prueba a punto de acabar, errores del chat… Hoy esa decisión está repartida:

- la app evalúa los `when` de cada mensaje y calcula fechas (`membershipPlanExpired`);
- telemetría mezcla dos situaciones distintas en un mismo `payment_status: expired`;
- la app traduce los errores del Gateway con textos fijos en su código.

La propuesta separa responsabilidades:

| Quién | Qué hace | Qué NO hace |
|---|---|---|
| **Telemetría** y **Gateway** | Dicen *qué ha pasado* con **códigos de dominio** y sus datos (`params`) | No saben de mensajes, pantallas ni idiomas |
| **app-messages** | Un **catálogo** (`codes.json`): para cada código, qué mensaje se enseña y si bloquea. Los mensajes (JSON + HTML) son los de siempre | No calcula estados |
| **App** | Junta los códigos, los **busca** en el catálogo, pinta el mensaje y bloquea si el catálogo lo dice | No decide nada: no evalúa condiciones ni calcula fechas |

Cambiar qué mensaje sale para un caso, su texto o si bloquea es un PR en `app-messages`. No hace falta desplegar telemetría, el Gateway ni la app.

## Regla de producto

El plan **caducado por tiempo** y la **cuota agotada** son cosas distintas:

| Plan vencido por tiempo | Cuota agotada | Qué pasa |
|---|---|---|
| No | No | Nada |
| No | Sí | Aviso. La app sigue funcionando; solo no se puede usar la IA |
| Sí | No | Muro: la app queda bloqueada |
| Sí | Sí | Muro |

Esta regla vive en el catálogo (`block`), no en el código de nadie.

Y para las suscripciones de pago:

| Situación | Qué pasa |
|---|---|
| **Cancelación** (el usuario no quiere renovar) | No bloquea al momento: conserva el acceso hasta la fecha de fin y entonces caduca (`PLAN_EXPIRED`). Cancelar es parar la **renovación automática**; aún no está implementado y, cuando lo esté, no debe revocar la membresía |
| **Impagada** (Stripe la termina tras los reintentos) | Sin derecho a la app (`PLAN_REVOKED`), **salvo** que tenga un trial o un plan en vigor: entonces telemetría responde con ese y no hay código |
| **Mejora de un trial cuyo pago falla** | Se queda con su trial: no se crea la membresía de pago (billing sólo la concede con el pago hecho) |

---

## 1. Formato de un código

```json
{ "code": "QUOTA_EXHAUSTED.INPUT_TOKENS_LIMIT_REACHED", "params": { "plan_code": "free_plan", "used": 500000, "limit": 500000 } }
```

- **`code`**: `<SITUACIÓN>.<MOTIVO>`, en mayúsculas. Los motivos son los que telemetría ya usa por dentro (`DAYS_LIMIT_REACHED`, `INPUT_TOKENS_LIMIT_REACHED`…).
- **`params`**: los datos que el mensaje puede necesitar, sin formatear (fechas en ISO 8601, números sin unidades). La app los pone en las variables del mensaje: `{{params.expires_at | date:long}}`. Así la app tampoco tiene que juntar datos de billing y telemetría para rellenar los textos.

Hay códigos de dos tipos:

| Tipo | Quién lo emite | Cuánto dura | Dónde llega |
|---|---|---|---|
| **Estado** | Telemetría | Mientras siga siendo cierto | `GET /api/user-usage/{uid}` → `status_codes` |
| **Evento** | Gateway | Lo que dura una petición | El cuerpo de error del chat: `code` (+ `details.constraintCode`) |

## 2. Lista de códigos

### 2.1 Estado (telemetría)

| Código | Cuándo | `params` | Bloquea | Mensaje |
|---|---|---|---|---|
| `PLAN_EXPIRED.DAYS_LIMIT_REACHED` | `now >= created_at + max_days` de la membresía en vigor, **aunque antes se agotara la cuota** | `plan_code`, `plan_name`, `created_at`, `expires_at`, `max_days` | Sí | `trial_expired` si `plan_code` es `free_plan`; si no, `subscription_expired` |
| `QUOTA_EXHAUSTED.PROMPTS_LIMIT_REACHED` | Contador de prompts ≥ `max_prompts` (un límite con ventana no cuenta: se renueva solo) | `plan_code`, `used`, `limit`, `usage_percentage`, `since`, `resets_at` (hoy `null`) | No | `trial_quota_exhausted` si `plan_code` es `free_plan`; si no, `quota_exhausted` |
| `QUOTA_EXHAUSTED.INPUT_TOKENS_LIMIT_REACHED` | Tokens de entrada ≥ `max_input_tokens` | ídem | No | ídem |
| `QUOTA_EXHAUSTED.OUTPUT_TOKENS_LIMIT_REACHED` | Tokens de salida ≥ `max_output_tokens` | ídem | No | ídem |
| `PLAN_REVOKED` | La membresía que se responde está revocada (`expired_reason: revoked`): no queda ninguna en vigor. Hoy es la suscripción impagada (Stripe la termina tras los reintentos) o una baja de un administrador | `plan_code` | Sí | `payment_failed` |
| `NO_PLAN` | La cuenta no tiene ninguna membresía (ni en vigor ni caducada): p. ej. volvió a registrarse con el correo de una cuenta borrada y no recibe trial | — | Sí | `no_plan` (con «Volver a comprobar», por si el trial de un alta aún no ha llegado) |
| `PLAN_EXPIRING_SOON` | Quedan `≤ N` días para `expires_at` (`N` en la configuración de telemetría; hoy 2) | `plan_code`, `expires_at`, `days_left` | No | `trial_ending_soon` |
| `PLAN_STARTED` | La membresía en vigor es de pago y tiene menos de 24 h | `plan_code`, `plan_name`, `created_at` | No | `purchase_success` |

Las membresías `replaced` (sustituidas por otra más nueva) no generan código: no le pasa nada al usuario.

### 2.2 Eventos (Gateway)

El Gateway no cambia: el código del catálogo se forma con lo que ya responde, `GATEWAY.<code>` y, si viene `details.constraintCode`, `.<constraintCode>`.

| Código en el catálogo | Respuesta actual del Gateway | Bloquea | Qué hace la app |
|---|---|---|---|
| `GATEWAY.INSUFFICIENT_CAPABILITY.max_days` | 403, plan caducado por tiempo | Sí | Muro genérico (`plan_expired`: el Gateway no dice el plan) y vuelve a pedir `user-usage`, que trae `PLAN_EXPIRED` con el plan y gana por prioridad |
| `GATEWAY.INSUFFICIENT_CAPABILITY` | 403, el plan no incluye la capacidad | No | Texto en el chat |
| `GATEWAY.USAGE_LIMIT_EXCEEDED.<constraint>` | 403, cuota del plan | No | Como `QUOTA_EXHAUSTED.*` (la app pone el `plan_code` de la sesión, que el Gateway no dice) y vuelve a pedir `user-usage` |
| `GATEWAY.TOKEN_LIMIT_EXCEEDED` | 403, cuota de tokens | No | ídem |
| `GATEWAY.WINDOW_LIMIT_EXCEEDED` | 429, la ventana de uso del plan está llena (`window_in_minutes`) | No | ídem; telemetría da `QUOTA_EXHAUSTED.*` con `resets_at` = fin de la ventana |
| `GATEWAY.RATE_LIMIT_EXCEEDED` | 429 | No | Texto en el chat: «Demasiadas peticiones, espera un momento» |
| `GATEWAY.EMAIL_NOT_VERIFIED` | 403 | No | Mensaje para verificar el correo |
| `GATEWAY.ACCOUNT_NOT_READY` | 403 | No | Texto en el chat |
| `GATEWAY.ACCOUNT_STATUS_UNAVAILABLE` | 503 | No | Texto en el chat: «Reintenta en unos segundos» |
| `GATEWAY.AUTH_UNAVAILABLE` | 503 | No | Texto en el chat |
| `GATEWAY.NOT_AUTHENTICATED` | 401 | No | La app vuelve al acceso; no es un mensaje |
| `GATEWAY.INVALID_REQUEST` | 400 | No | Texto en el chat |
| `GATEWAY.PROVIDER_ERROR` | 502 | No | Texto en el chat |

---

## 3. Especificación para telemetría

### 3.1 Qué cambia en la respuesta

En `GET /api/user-usage/{uid}` se **añade** un campo. No se quita ni se cambia ninguno: la web y el Gateway siguen leyendo `payment_status` igual que hoy.

```jsonc
{
  "user_id": "…",
  "payment_status": "expired",          // sin cambios
  "expired_reason": "usage",            // sin cambios
  "usage_percentage": null,             // sin cambios
  // …
  "status_codes": [                     // NUEVO: siempre presente; [] si no pasa nada
    {
      "code": "QUOTA_EXHAUSTED.INPUT_TOKENS_LIMIT_REACHED",
      "params": { "plan_code": "free_plan", "used": 500000, "limit": 500000,
                  "since": "2026-10-02T13:03:34.478Z", "resets_at": null }
    }
  ]
}
```

- Un 404 (sin métricas) sigue siendo 404: la app lo trata como `status_codes: []`.
- El orden de la lista no importa: lo pone el catálogo.
- Un usuario de la whitelist recibe `[]`.

### 3.2 La corrección que hace falta

Hoy `process_membership` (`user-validation-service.ts`) marca la membresía como `expired` con el **primer** motivo que encuentra y no vuelve a evaluarla. Por eso:

1. Si se agota la cuota, queda `expired` / `usage`. Para el usuario parece caducada aunque al plan le queden días.
2. Si **después** pasa la fecha, sigue `expired` / `usage`. Nunca se emitiría `PLAN_EXPIRED.DAYS_LIMIT_REACHED` y la app no bloquearía.

`status_codes` tiene que calcularse **en cada consulta**, comprobando la fecha y la cuota **por separado**, con independencia de lo que haya guardado en `payment_status` / `expired_reason`:

```
membresía = la última en vigor o, si no hay, la última caducada que no sea `replaced`

codes = []
si max_days y now >= created_at + max_days      → PLAN_EXPIRED.DAYS_LIMIT_REACHED
para cada constraint de cuota activo:
  si contador >= limit                          → QUOTA_EXHAUSTED.<MOTIVO>     (todos los que se cumplan)
si revocada y no hay otra en vigor              → PLAN_REVOKED
si no hay PLAN_EXPIRED y expires_at - now <= N días → PLAN_EXPIRING_SOON
si es de pago y now - created_at < 24 h         → PLAN_STARTED
```

Si la caducidad que se guarda en MongoDB (lo que lee el Gateway) debe distinguir también los dos motivos es una decisión aparte (§6). Para este contrato basta con que `status_codes` sea correcto.

### 3.3 Tests mínimos

| Caso | `status_codes` esperado |
|---|---|
| Plan sano | `[]` |
| Cuota de tokens agotada, plan en fecha | `[QUOTA_EXHAUSTED.INPUT_TOKENS_LIMIT_REACHED]` |
| Fecha pasada, cuota sin agotar | `[PLAN_EXPIRED.DAYS_LIMIT_REACHED]` |
| Cuota agotada **y después** fecha pasada (guardado como `expired` / `usage`) | `[PLAN_EXPIRED.DAYS_LIMIT_REACHED, QUOTA_EXHAUSTED.…]` |
| Trial con 2 días | `[PLAN_EXPIRING_SOON]` |
| Plan de pago creado hace 3 h | `[PLAN_STARTED]` |
| Usuario de la whitelist con el plan caducado | `[]` |
| Membresía sustituida por otra más nueva | Solo los códigos de la nueva |

---

## 4. El catálogo en app-messages (`codes.json`)

```json
{
  "schema_version": 1,
  "codes": {
    "PLAN_EXPIRED.DAYS_LIMIT_REACHED": {
      "priority": 110, "block": true,
      "message": { "free_plan": "trial_expired", "*": "subscription_expired" }
    },
    "GATEWAY.INSUFFICIENT_CAPABILITY.max_days": {
      "priority": 100, "block": true, "recheck": true,
      "message": "plan_expired"
    },
    "PLAN_REVOKED":                       { "priority": 105, "block": true, "message": "payment_failed" },
    "QUOTA_EXHAUSTED.*":                  { "priority": 50, "block": false, "message": { "free_plan": "trial_quota_exhausted", "*": "quota_exhausted" } },
    "GATEWAY.USAGE_LIMIT_EXCEEDED.*":     { "priority": 50, "block": false, "recheck": true, "message": { "free_plan": "trial_quota_exhausted", "*": "quota_exhausted" } },
    "GATEWAY.TOKEN_LIMIT_EXCEEDED":       { "priority": 50, "block": false, "recheck": true, "message": { "free_plan": "trial_quota_exhausted", "*": "quota_exhausted" } },
    "PLAN_STARTED":                       { "priority": 40, "block": false, "message": "purchase_success" },
    "PLAN_EXPIRING_SOON":                 { "priority": 20, "block": false, "message": "trial_ending_soon" },
    "GATEWAY.EMAIL_NOT_VERIFIED":         { "priority": 60, "block": false, "message": "email_not_verified" },
    "GATEWAY.RATE_LIMIT_EXCEEDED":        { "priority": 10, "inline": { "es": "Demasiadas peticiones. Espera un momento y vuelve a intentarlo.", "en": "Too many requests. Wait a moment and try again." } },
    "GATEWAY.ACCOUNT_STATUS_UNAVAILABLE": { "priority": 10, "inline": { "es": "No hemos podido comprobar tu cuenta. Reintenta en unos segundos.", "en": "We couldn't check your account. Try again in a few seconds." } }
  },
  "fallback": {
    "GATEWAY.*": { "inline": { "es": "Algo ha fallado. Vuelve a intentarlo.", "en": "Something went wrong. Try again." } },
    "*": null
  }
}
```

| Campo | Qué es |
|---|---|
| `message` | El id de un mensaje de `index.json`. Puede ser un objeto por `params.plan_code`, con `*` como valor por defecto |
| `inline` | En lugar de un mensaje, un texto corto que la app pone en el chat (eventos del Gateway) |
| `block` | `true`: muro. La app queda tapada mientras el código siga activo |
| `priority` | Si hay varios códigos, el mayor se ve primero. Con uno que bloquea, el resto espera |
| `recheck` | Al recibirlo, la app vuelve a pedir `user-usage` |
| `QUOTA_EXHAUSTED.*` | Comodín: cualquier motivo de esa situación. Gana la clave exacta si existe |
| `fallback` | Qué hacer con un código desconocido. Así telemetría puede añadir códigos antes de que tengan mensaje sin romper nada |

**Validación en la CI** (`scripts/validate.mjs`):
- cada `message` existe en `index.json`;
- cada entrada tiene `message` o `inline`, pero no las dos;
- todo texto `inline` tiene `es`;
- cada código de las tablas del §2 tiene entrada, exacta o por comodín.

## 5. Qué hace la app

1. Junta los códigos activos:
   - `status_codes` de la última respuesta de `user-usage`, guardada en disco para usarla sin red;
   - el código del último error del Gateway, que solo vale mientras se muestra.
2. Busca cada uno en `codes.json` (también en caché): primero la clave exacta, después el comodín, después `fallback`.
3. Si la entrada lleva `message`, elige la variante por `params.plan_code`.
4. Ordena por `priority`. Si alguna entrada tiene `block: true`, pinta el muro con la de mayor prioridad. Si no, pinta las demás como hoy (diálogo, banner, abajo).
5. Rellena las variables con `params` del código (`{{params.expires_at | date:long}}`) y con los datos de la sesión (`{{user.name}}`). Los colores `{{c.*}}` siguen siendo del tema.
6. Los cierres (X, `persistent`) siguen siendo como hoy: los guarda la app.

**Sale del código de la app:**
- `WhenEvaluator`, la evaluación local de `when`, `AccountContext.build`;
- la parte de fechas de `membershipExpired`;
- los textos fijos de los errores del Gateway.

**Sin red y sin caché** (primer arranque sin conexión), la app no tiene códigos y no bloquea. Bloquear de verdad lo sigue haciendo el Gateway, que rechaza las peticiones de un plan caducado.

## 6. Pendiente de decidir

1. ~~**`PLAN_REVOKED`**~~: decidido (ver la tabla de suscripciones de pago); sale `payment_failed`. Pendiente: la cancelación (§8).
2. **¿La cuota se renueva?** Decidido por tipo de plan:
   - **Trial** (`free_plan`): no se renueva. Agotada, solo vuelve activando un plan; si espera, el trial caduca por fecha (`PLAN_EXPIRED`). Mensaje `trial_quota_exhausted`, sin «Esperar a la renovación».
   - **Plan de pago:** tendrá ventanas de uso (en desarrollo). Mensaje `quota_exhausted` con «Se renueva {{usage_reset}}»; cuando estén, telemetría da `resets_at` y la app lo pone en `usage_reset` (hoy `null`: texto genérico).
3. **Lo que guarda MongoDB:** ¿la caducidad guardada (lo que lee el Gateway) también debe separar fecha y cuota? Si una cuota agotada no debe impedir el resto de la app pero sí el chat, el Gateway ya lo resuelve con la capacidad o la cuota (`USAGE_LIMIT_EXCEEDED`). Conviene revisarlo con quien lleve el Gateway.
4. **`N` de `PLAN_EXPIRING_SOON`** y la ventana de `PLAN_STARTED` (24 h): ¿configuración de telemetría o fijos?
5. **Mensajes nuevos que habría que crear:** `email_not_verified` y los textos `inline` definitivos (`payment_failed` ya existe).
6. ~~**Los `when` actuales**~~: ya no existen; `codes.json` los sustituye.

## 7. Estado de la implantación

| Pieza | Hecho |
|---|---|
| Telemetría | `status_codes` en `/api/user-usage` y en el snapshot: `PLAN_EXPIRED.DAYS_LIMIT_REACHED`, `QUOTA_EXHAUSTED.*`, `PLAN_EXPIRING_SOON`, `PLAN_REVOKED` (`computeStatusCodes`) |
| app-messages | `codes.json`, validador, `fixtures/codes/`, mensaje `payment_failed`; fuera los `when` y `POST /v1/messages` |
| App (GPT-UI) | Lee `status_codes` y nombra el rechazo del Gateway (`GATEWAY.<code>[.<constraintCode>]`), los busca en `codes.json`, pinta y bloquea; sin lógica propia de caducidad ni de cuota. Sólo un rechazo que el catálogo no conoce sale como texto |
| Web | `lib/membership.js` decide con `status_codes` (`PLAN_EXPIRED.*`, `PLAN_REVOKED`); sin ellos, como antes |

Orden de despliegue: telemetría y web a la vez (o la web antes), después `app-messages`, después la app. Una app nueva con una telemetría antigua no recibe códigos y no bloquea; el Gateway sigue rechazando.

Pendiente: cuándo se renueva la cuota (`resets_at`, §6), `PLAN_STARTED`, los códigos del Gateway que aún no están en el catálogo, y la cancelación (§8).

## 8. Cancelación de una suscripción (pendiente)

**Regla:** cancelar no quita el acceso al momento. El usuario conserva el plan hasta su fecha de fin y entonces caduca como cualquier plan (`PLAN_EXPIRED.DAYS_LIMIT_REACHED`, muro `subscription_expired`). Lo que se bloquea es la **renovación automática**: no se vuelve a cobrar.

**Cómo debe implementarse** (no hecho):

1. **billing:** cancelar = `stripe.subscriptions.update(id, { cancel_at_period_end: true })`, no `subscriptions.cancel`. Así Stripe no vuelve a cobrar y manda `customer.subscription.deleted` al final del periodo.
2. **telemetría:** la membresía sigue `paid` hasta su `max_days`. El `customer.subscription.deleted` que llegue al final no debe acabar en `PLAN_REVOKED`: o se ignora si ya pasó la fecha, o se guarda con otro motivo (p. ej. `expired_reason: "canceled"`) que `computeStatusCodes` trate como fecha (`PLAN_EXPIRED` cuando toque), no como impago. Stripe distingue el motivo en `cancellation_details.reason` (`cancellation_requested` frente a `payment_failed`).
3. **Opcional, aviso:** un código `PLAN_CANCELED` mientras el plan sigue en vigor (con `expires_at` en `params`), para que la app y la web digan «tu plan termina el …, no se renovará». Sería una entrada más de `codes.json` con `block: false`.
4. **Web y app:** nada que decidir; si se añade el aviso del punto 3, sólo su mensaje en `app-messages`.

Hasta entonces una suscripción sólo se termina por impago o por una baja de un administrador, y eso sí es `PLAN_REVOKED`.
