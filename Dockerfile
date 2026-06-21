FROM oven/bun:1-alpine

WORKDIR /app

# Self-contained bundle (protocol inlined via `bun build`); no node_modules needed.
COPY dist/relay.js ./relay.js

ENV PORT=8080
EXPOSE 8080

CMD ["bun", "run", "relay.js"]
