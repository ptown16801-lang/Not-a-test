FROM node:22-alpine

WORKDIR /app
COPY package.json ./
COPY src ./src
COPY demo ./demo
COPY assets ./assets

RUN mkdir -p /data && chown node:node /data
USER node

ENV NODE_ENV=production HOST=0.0.0.0 PORT=8787 THOUGHT_LEDGER_PATH=/data/thought-ledger.jsonl
EXPOSE 8787
HEALTHCHECK --interval=15s --timeout=3s --start-period=5s --retries=3 CMD wget -qO- http://127.0.0.1:8787/ready >/dev/null || exit 1
CMD ["node","demo/intake-server.js"]
