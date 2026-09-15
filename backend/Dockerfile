# syntax=docker/dockerfile:1

# --- Stage: fetch the pinned Tectonic binary --------------------------------
FROM debian:bookworm-slim AS tectonic
ARG TECTONIC_VERSION=0.17.0
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
RUN curl -fsSL -o /tmp/tectonic.tar.gz \
      "https://github.com/tectonic-typesetting/tectonic/releases/download/tectonic%40${TECTONIC_VERSION}/tectonic-${TECTONIC_VERSION}-x86_64-unknown-linux-musl.tar.gz" \
    && tar -xzf /tmp/tectonic.tar.gz -C /usr/local/bin \
    && chmod +x /usr/local/bin/tectonic \
    && rm /tmp/tectonic.tar.gz

# --- App -------------------------------------------------------------------
FROM node:22-bookworm-slim AS app
WORKDIR /app
ENV TECTONIC_BIN=/usr/local/bin/tectonic
ENV XDG_CACHE_HOME=/opt/tectonic-cache

COPY --from=tectonic /usr/local/bin/tectonic /usr/local/bin/tectonic

COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

COPY . .
RUN npm run build

# Pre-fetch Tectonic's LaTeX package bundle at build time (network is
# available during the build) so that no compile at runtime ever needs to
# reach the network — the resume text it compiles is AI-generated from
# user-supplied input and shouldn't get an outbound network path.
RUN mkdir -p "$XDG_CACHE_HOME" /tmp/tectonic-warmup \
    && printf '\\documentclass{article}\\begin{document}warmup\\end{document}' > /tmp/tectonic-warmup/input.tex \
    && tectonic --outdir /tmp/tectonic-warmup /tmp/tectonic-warmup/input.tex \
    && rm -rf /tmp/tectonic-warmup

RUN npm prune --omit=dev

ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "dist/index.js"]
