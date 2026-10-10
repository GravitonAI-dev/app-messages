# Notas para agentes — app-messages

Reglas de trabajo en este repo. `CLAUDE.md` la importa para Claude Code, así
que se edita aquí y no se duplica.

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

Pasó el 2026-10-10: `main` llevaba dos días una implementación de las ventanas
de uso que `develop` no tenía. Se trabajó sobre `develop`, el merge a `main`
dio ocho ficheros en conflicto y se subieron con los marcadores dentro: `main`
dejó de compilar y hubo que revertir. Dos personas habían escrito la misma
funcionalidad.
