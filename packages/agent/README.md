# @chama/agent

Autonomous off-chain operator for one or more `Chama` contracts on Celo. Runs as a pure
background worker — no HTTP surface — and operates every chama produced by the configured
`ChamaFactory` plus the seed `Chama` listed in `packages/contracts/deployments/<chainId>.json`.

## What it does

Every `AGENT_TICK_MS` (default 15 s):
1. **Discovers** active chamas by calling `factory.latestChamas(50)` plus the seed `Chama`. New chamas are cached.
2. **Pulls contributions:** for each member who hasn't paid this cycle, if they have sufficient cUSD balance + allowance, signs `contributeFor(member)`.
3. **Pushes payouts:** when every member has contributed (or the cycle deadline has elapsed), signs `executePayout()`.

It never custodies funds. Members approve the `Chama` contract directly; the agent's private key only signs workflow calls the contract permits.

## Required env (read from `../../.env`)

| name | required | example |
|---|---|---|
| `DEPLOYER_PRIVATE_KEY` | yes | `0x…` (this is the agent's wallet) |
| `AGENT_TICK_MS` | no | `15000` |
| `CELO_SEPOLIA_RPC` | no (defaults to public fallbacks) | comma-separated list of HTTP RPCs |

The agent reads contract addresses from `packages/contracts/deployments/11142220.json`. Run `pnpm --filter @chama/contracts deploy:sepolia` followed by `… deploy-factory:sepolia` before launching.

## Local

```bash
pnpm install
pnpm --filter @chama/agent dev   # tsx, no watch — runs until killed or all chamas complete
```

## Deploy to Fly.io

```bash
# From the monorepo root
fly launch --copy-config --no-deploy        # first time
fly secrets set DEPLOYER_PRIVATE_KEY=0x...   # never commit this
fly deploy --dockerfile packages/agent/Dockerfile
```

## Deploy to Railway

Connect the repo, point the service at `packages/agent/Dockerfile`, set `DEPLOYER_PRIVATE_KEY` as a service variable, deploy. `railway.json` at the package root holds the rest.

## Notes for mainnet

`packages/contracts/deployments/42220.json` will be picked up automatically when the chain RPC points at Celo mainnet. Make sure the agent wallet has CELO for gas. Hardening for mainnet (alerting, multi-region, key rotation) is the next step.
