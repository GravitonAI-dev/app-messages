# Tonos

Los colores son los de la web de ConfAI (`app/globals.css` y `tailwind.config.js` de ConfAI-Web-Nextjs). Cambiar el tono de un mensaje = cambiar el color del kicker (pastilla superior) y, si procede, el valor destacado del panel. Los botones son siempre morados (`.btn--primary`), como en la web, salvo que un mensaje necesite otra cosa.

| Tono | Uso | Color | Fondo de la pastilla |
|---|---|---|---|
| brand | ofertas, upgrade, fin de trial | `#9B8FD4` (texto) / `#7D67C0` (botón) | `rgba(125,103,192,0.15)` |
| error | plan caducado, pago fallido | `#EF4444` | `rgba(239,68,68,0.15)` |
| warning | cuota agotada | `#F59E0B` | `rgba(245,158,11,0.15)` |
| info | avisos, novedades, trial a punto de acabar | `#3B82F6` | `rgba(59,130,246,0.15)` |
| success | compra completada, trial renovado | `#10B981` | `rgba(16,185,129,0.15)` |

## Tokens fijos de la tarjeta

| Pieza | Valor |
|---|---|
| Fondo de la tarjeta (`bg-card`) | `#14142A` |
| Borde (`cai-border`) | `1px solid rgba(255,255,255,0.08)` |
| Radio de la tarjeta (`radius-lg`) | `16px` · toasts `10px` |
| Panel interior | `rgba(255,255,255,0.03)` con el mismo borde, radio `10px` |
| Texto principal (`cai-text`) | `#F1F1F4` |
| Texto secundario | `#A0A0B8` |
| Texto apagado (`cai-text-muted`) | `#9090A8` |
| Primario | `#7D67C0` · claro `#9B8FD4` · oscuro `#6655A8` |
| Botón primario | fondo `#7D67C0`, blanco, radio `6px`, `600`, 14px 36px |
| Botón secundario | fondo `rgba(125,103,192,0.14)`, texto `#9B8FD4`, borde `rgba(125,103,192,0.55)` |
| Kicker | mayúsculas, 12px, 700, `letter-spacing 0.08em`, pastilla |
| Titular | 28px (modales) / 24px, 800, `letter-spacing -0.02em` |
| Fuente | Geist, system-ui |
| Logo | `assets/logo.png` (escudo morado) + wordmark "Conf" + "AI" en `#9B8FD4` |
