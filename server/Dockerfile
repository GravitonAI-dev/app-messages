# Se construye desde la raíz del repo: el contenido (index.json, codes.json, messages/…)
# va dentro de la imagen, así que publicar un mensaje es desplegar la imagen.
#   docker build -f server/Dockerfile .
#
# La toolchain (node, pnpm) la fija este fichero y nadie más: el CI valida con
# `--target test` y el VPS sólo hace `docker compose pull/up`. Ni el runner ni
# el VPS necesitan node ni pnpm instalados.

# Dependencias, una vez para todos los stages. `cd server` antes de pnpm: es
# server/package.json quien declara `packageManager`, y corepack elige la
# versión leyendo el package.json del directorio actual.
FROM node:22-alpine AS deps
WORKDIR /repo
RUN corepack enable
COPY server/package.json server/pnpm-lock.yaml ./server/
RUN cd server && pnpm install --frozen-lockfile

# Todo lo que comprueba el CI, con la misma toolchain con la que se publica.
# Si algo falla, falla el build. No se publica: sólo se construye con
# `--target test`.
FROM deps AS test
COPY . .
RUN node scripts/validate.mjs \
 && node scripts/test-fixtures.mjs \
 && cd server && pnpm test

FROM deps AS builder
COPY server/tsconfig.json ./server/
COPY server/src ./server/src
RUN cd server && pnpm build && pnpm prune --prod

FROM node:22-alpine
ENV NODE_ENV=production CONTENT_DIR=/repo PORT=3000
WORKDIR /repo
COPY index.json codes.json ./
COPY messages ./messages
COPY home ./home
COPY assets ./assets
COPY preview ./preview
COPY templates ./templates
COPY server/package.json ./server/
COPY --from=builder /repo/server/node_modules ./server/node_modules
COPY --from=builder /repo/server/dist ./server/dist
WORKDIR /repo/server
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:3000/health >/dev/null || exit 1
CMD ["node", "dist/main.js"]
