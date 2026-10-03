# Tokens y tonos

Los mensajes se pintan con el design system de la app Flutter (`lib/src/theme/design_system/`). En el HTML los colores van SIEMPRE como variables `{{c.<rol>}}`: la app las sustituye por el valor del tema activo (claro u oscuro) antes de renderizar. No se escriben colores fijos.

## Roles de color disponibles

| Variable | Claro | Oscuro | Uso |
|---|---|---|---|
| `{{c.brandPrimary}}` | `#7D67C0` | `#7D67C0` | botón primario, enlaces, acento |
| `{{c.brandHover}}` | `#6A55A8` | `#6A55A8` | |
| `{{c.accentSoft}}` | `rgba(125,103,192,.08)` | igual | fondo de pastillas de marca |
| `{{c.textOnAccent}}` | `#FFFFFF` | `#FFFFFF` | texto sobre el acento |
| `{{c.surface}}` | `#FFFFFF` | `#1B1B1F` | fondo de la tarjeta |
| `{{c.surfaceMuted}}` | `#F4F7FC` | `#16161A` | fondo de la app |
| `{{c.surfaceRaised}}` | `#FBFCFE` | `#232329` | tile del icono, panel de datos |
| `{{c.textPrimary}}` | `#1F2937` | `#F2F3F5` | títulos, valores |
| `{{c.textHeading}}` | `#374151` | `#C9CDD6` | títulos grandes suaves |
| `{{c.textSecondary}}` | `#4B5563` | `#B8BDC9` | cuerpo |
| `{{c.textMuted}}` | `#6B7280` | `#9BA3B3` | etiquetas |
| `{{c.textTertiary}}` | `#9CA3AF` | `#868FA0` | notas, descripciones |
| `{{c.border}}` | `#E9EDF5` | `#2D2D33` | bordes |
| `{{c.divider}}` | `#EEF1F6` | `#26262B` | separadores |
| `{{c.controlBorder}}` | `#C3C3C3` | `#3A3A42` | borde del botón outline |
| `{{c.success}}` / `{{c.successSurface}}` | `#14804A` / `#E1FCEF` | `#3FBE7E` / `#13301F` | tono éxito |
| `{{c.warning}}` / `{{c.warningSurface}}` | `#D97706` / `#FDF6E7` | `#F59E0B` / `#3A2A0C` | tono aviso |
| `{{c.danger}}` / `{{c.dangerText}}` / `{{c.dangerSurface}}` | `#D12953` / `#B31F45` / `#FAF0F3` | `#F06A8B` / `#F06A8B` / `#351A22` | tono error |
| `{{c.infoSurface}}` | `rgba(125,103,192,.08)` | igual | tono info |
| `{{c.logoText}}` | `#6B6B6B` (gris del wordmark, aclarado por Yeray) | `#D7D7DB` (sidebarText) | la parte "Conf" del wordmark sobre fondo claro |
| `{{c.brandSurface}}` | `#0D0D14` | `#0D0D14` | fondo oscuro de marca (cabecera de la web), igual en ambos temas |
| `{{c.brandLight}}` | `#9B8FD4` | `#9B8FD4` | morado claro del "AI" del wordmark sobre fondo oscuro |

## Tonos

| Tono | Kicker (texto / fondo) | Valor destacado |
|---|---|---|
| brand | `{{c.brandPrimary}}` / `{{c.accentSoft}}` | `{{c.brandPrimary}}` |
| danger | `{{c.dangerText}}` / `{{c.dangerSurface}}` | `{{c.dangerText}}` |
| warning | `{{c.warning}}` / `{{c.warningSurface}}` | `{{c.warning}}` |
| success | `{{c.success}}` / `{{c.successSurface}}` | `{{c.success}}` |
| info | `{{c.brandPrimary}}` / `{{c.infoSurface}}` | `{{c.brandPrimary}}` |

## Medidas (tokens de la app)

| Pieza | Valor |
|---|---|
| Fuente | Open Sans |
| Título (title1) | 20px, 700, letter-spacing -0.3px |
| Cuerpo (body) | 12.5-13px, 400, line-height 1.5 |
| Nota (bodySmall) | 11.5px |
| Kicker (microLabel) | 9.5-10px, 600, letter-spacing 0.6px, mayúsculas |
| Radio de tarjeta / panel / tile | 10px |
| Radio de botón / pastilla | 6px |
| Tile del icono | 44×44, `surfaceRaised`, borde `border` |
| Botón primario | `brandPrimary` + `textOnAccent`, 10px 18px, 13px 600 |
| Botón outline | `surface`, borde `controlBorder`, `textPrimary` |
| Toast (AppBanner) | borde + barra izquierda 3px del tono, radio 6px, 12px 14px |
| Anchos del contenedor | sm 360 · md 460 (AppDialog) · lg 620 |
