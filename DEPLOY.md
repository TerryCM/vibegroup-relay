# Deploying the vibegroup relay

The relay is a single self-contained Bun WebSocket server. The simplest hosted path is **Azure Container Apps** — HTTPS/WSS ingress, cloud build from source, scale-to-zero.

## Live instance (alpha)

```
wss://relay.vibegroup.sh/ws
```

> Alpha instance on the maintainer's Azure subscription — fine for trying vibegroup, not a stability guarantee. For anything real, deploy your own (below).

```bash
# sanity check
curl https://relay.vibegroup.sh/health   # → ok
```

## Deploy your own (Azure Container Apps)

Prereqs: [Azure CLI](https://learn.microsoft.com/cli/azure/install-azure-cli), the `containerapp` extension (`az extension add --name containerapp`), and `az login`.

```bash
# 1. Bundle the relay into a self-contained dist/relay.js (protocol inlined)
bun run build

# 2. Build in the cloud + deploy, with a generated server secret
SECRET=$(openssl rand -hex 24)
az containerapp up \
  --name vibegroup-relay \
  --resource-group vibegroup-rg \
  --location eastus \
  --environment vibegroup-env \
  --source . \
  --target-port 8080 \
  --ingress external \
  --env-vars PORT=8080 "RELAY_SECRET=$SECRET"
```

`az containerapp up` builds the [`Dockerfile`](Dockerfile) via ACR, stands up a managed environment, and prints your app's `https://…azurecontainerapps.io/` URL. Use `wss://<that-host>/ws` as `VIBEGROUP_RELAY_URL`.

`RELAY_SECRET` signs peer resume tokens — keep it stable and private (rotating it invalidates resume tokens). For production, store it as a Container Apps secret rather than a plain env var.

## Manage

```bash
az containerapp logs show -n vibegroup-relay -g vibegroup-rg --follow
az containerapp show   -n vibegroup-relay -g vibegroup-rg --query properties.configuration.ingress.fqdn -o tsv
az containerapp update -n vibegroup-relay -g vibegroup-rg --set-env-vars KEY=VALUE
az group delete -n vibegroup-rg            # tear everything down
```

## Anywhere else

The relay needs only the Bun runtime and the bundle:

```bash
bun run build && bun run dist/relay.js   # honors PORT and RELAY_SECRET
```

Any host with WebSocket-capable ingress works — Fly.io, Render, a VM behind Caddy/nginx, etc. Terminate TLS at the edge and proxy `/ws` with upgrade headers.
