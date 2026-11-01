FROM node:22-bookworm-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production HOSTNAME=0.0.0.0 PORT=3000 NEXT_TELEMETRY_DISABLED=1 DATA_DIR=/var/lib/ischi/data
RUN groupadd --system --gid 1001 ischi && useradd --system --uid 1001 --gid ischi ischi && mkdir -p /var/lib/ischi/data && chown -R ischi:ischi /var/lib/ischi /app
COPY --from=build --chown=ischi:ischi /app/.next/standalone ./
COPY --from=build --chown=ischi:ischi /app/.next/static ./.next/static
COPY --from=build --chown=ischi:ischi /app/public ./public
COPY --from=build --chown=ischi:ischi /app/seeds ./seeds
USER ischi
EXPOSE 3000
VOLUME ["/var/lib/ischi/data"]
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
