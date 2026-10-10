# Notas para agentes — app-messages

Reglas de trabajo en este repo. `CLAUDE.md` la importa para Claude Code, así
que se edita aquí y no se duplica.

## Dónde se trabaja: `develop` integra, `main` es producción

- **`develop` es la rama de integración y prueba.** De ahí sale todo el
  trabajo y ahí vuelve: una rama por tarea (`feat/`, `fix/`, `docs/`…), y su
  merge a `develop` en cuanto esté lista. Nada de guardar trabajo terminado
  fuera de `develop`: si no está ahí, para los demás no existe.
- **`main` es la rama de producción**: lo que está desplegado. Solo recibe un
  merge **cuando se va a desplegar**, no antes. Un `main` que acumula cosas
  sin publicar deja de decir qué hay en el servidor, que es su única razón de
  ser.
- **`develop` se mantiene siempre al día.** Después de cada despliegue, y
  siempre que `main` reciba algo por su cuenta (un hotfix, un arreglo
  urgente), ese cambio vuelve a `develop` en el acto. Si las dos ramas se
  separan, lo que se prueba deja de ser lo que se publica.

## Antes de empezar: no partir de una rama por detrás de `main`

**Antes de tocar nada**, trabajes en `develop` o en cualquier otra rama,
comprueba que no va por detrás de `origin/main`; si lo va, ponte al día:

```bash
git fetch origin
git log --oneline HEAD..origin/main    # vacío = al día; si sale algo, falta en tu rama
git merge origin/main                  # sólo si salió algo
```

Ir **por delante** de `main` no importa: eso es trabajo pendiente de publicar.
Lo que rompe es empezar **por detrás**, porque te pierdes lo que otro ya
integró y acabas reimplementando lo mismo o abriendo un conflicto que nadie
resuelve bien.
