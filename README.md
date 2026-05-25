# ChamaAgent

**Trustless rotating savings groups (ROSCA / chama / ajo / esusu) on Celo — operated by an autonomous on-chain agent.**

A chama is a savings group where each member contributes a fixed amount every cycle, and the full pot rotates to one member per cycle until every member has been paid once. Hundreds of millions of people across Kenya, Nigeria, South Africa, Mexico, Ethiopia, Bangladesh, the Philippines, and immigrant communities worldwide use these informally. The bookkeeping and disbursement is the load-bearing failure point — the treasurer holds the cash, and the group dies when trust does.

ChamaAgent replaces the treasurer with code:

- **Members verified via Self ID** — zero-knowledge proof of humanity from a government passport, sybil-resistant without exposing PII.
- **Per-group Solidity escrow** holds cUSD on-chain. Members approve the contract directly. The agent has **no** custodial control.
- **An ERC-8004 registered agent** runs the workflow autonomously: pulls each member's contribution at the cycle window, pushes the full pot to the next member in turn, advances. Every step on-chain, auditable, irreversible by anything other than the contract's own rules.
- **Permissionless self-recovery** — if the agent goes offline, any member can keep the chama liquid by calling `contributeFor` themselves. Liveness doesn't depend on us.
- **MiniPay-ready** — built for the 15M+ wallets across 66 countries that already use cUSD daily.

Submitted to:

- **Celo Proof of Ship — May 2026** (AI Track)
- **Celo Onchain Agents Hackathon 2026** — tracking all three prize pools (Best Agent · Most Activity · Highest 8004scan Rank)

## How it works

```
                       ┌──────────────────────────────┐
                       │      Self Protocol Hub        │
                       │  Celo Sepolia 0x16ECBA…d74   │
                       └──────────┬──────────────────┘
                                  │ ZK passport proof
                                  ▼
┌─────────────────────┐    ┌────────────────────┐    ┌───────────────────────┐
│   ChamaFactory.sol  │───▶│     Chama.sol      │◀───│   ChamaAgent service   │
│  permissionless     │    │   per-group escrow │    │  (TS + viem cron)     │
│  createChama()      │    │   cUSD ERC-20      │    │  ERC-8004 Agent #274 │
└─────────────────────┘    │   immutable agent  │    │  watches the factory  │
                           └────────┬───────────┘    └───────────────────────┘
                                    │ events
                                    ▼
                       ┌──────────────────────────────┐
                       │   Web dashboard               │
                       │  Vite · React 19 · wagmi      │
                       │  RainbowKit · Tailwind v4     │
                       └──────────────────────────────┘
```

**Trust model:** the agent has zero financial trust. Members approve the Chama contract directly (not the agent) for cUSD spend. The agent's key signs only `contributeFor()` and `executePayout()` — and the contract enforces every invariant (one contribution per cycle, agent-only payout, fixed payout order, no withdrawal beyond payouts). Compromise the agent's key and you can drain *zero* funds; the worst you can do is grief the cycle clock.

## Live on Celo mainnet (production)

| Contract | Address | Explorer |
|---|---|---|
| **ChamaFactory** | `0x8cA82b18093880524f9EAbEf1bEFE5B864032918` | [Celoscan](https://celoscan.io/address/0x8cA82b18093880524f9EAbEf1bEFE5B864032918) |
| **ChamaVerifier** (Self consumer) | `0x95006724DAF308D5c1E416E4ba4793f6ED4B23c4` | [Celoscan](https://celoscan.io/address/0x95006724DAF308D5c1E416E4ba4793f6ED4B23c4) |
| cUSD (real Mento) | `0x765DE816845861e75A25fCA122bb6898B8B1282a` | [Celoscan](https://celoscan.io/address/0x765DE816845861e75A25fCA122bb6898B8B1282a) |
| Agent wallet | `0x60347C5337480460B7E274A3C05eBE445ec0b0b9` | [Celoscan](https://celoscan.io/address/0x60347C5337480460B7E274A3C05eBE445ec0b0b9) |
| **ERC-8004 Agent ID** | **#9146** | [**8004scan**](https://8004scan.io/agents/celo/9146) |
| Self IdentityVerificationHub | `0xe57F4773bd9c9d8b6Cd70431117d353298B9f5BF` | (mainnet — real passports required) |

The agent service is hosted on Render as a 24/7 background worker (`CHAIN_ID=42220`). It polls the ChamaFactory every ~15s for new chamas and operates each one's cycle clock — though every workflow function is permissionless, so the chama still advances even when the courtesy agent is offline.

## Also live on Celo Sepolia (testnet · iteration playground)

| Contract | Address | Explorer |
|---|---|---|
| ChamaFactory | `0x0c2819cdDF09eCE1Fa4a0C4Cb42872Fb6D4306Cd` | [Blockscout](https://celo-sepolia.blockscout.com/address/0x0c2819cdDF09eCE1Fa4a0C4Cb42872Fb6D4306Cd) |
| ChamaVerifier (Self staging) | `0xeA64FD5169B067b9dcfe6D318858cBc712953e62` | [Blockscout](https://celo-sepolia.blockscout.com/address/0xeA64FD5169B067b9dcfe6D318858cBc712953e62) |
| MockCUSD | `0x6798E399dd1862AfF50A8e9B906f09ccEfF76AC0` | [Blockscout](https://celo-sepolia.blockscout.com/address/0x6798E399dd1862AfF50A8e9B906f09ccEfF76AC0) |
| Sepolia agent wallet | `0x7E65877b560Db3863baB4BC32F60e3c6693a9B06` | [Blockscout](https://celo-sepolia.blockscout.com/address/0x7E65877b560Db3863baB4BC32F60e3c6693a9B06) |
| Sepolia Agent ID | #274 | [8004scan](https://8004scan.io/agents/celo-sepolia/274) |

The Sepolia agent has driven 200+ on-chain transactions across 7 progressive deploys — that's where the iteration happened. Mainnet is the production endpoint with bytecode-identical contracts.

## Repo layout

```
chama-agent/
├── packages/
│   ├── contracts/         Solidity (Hardhat) — Chama, ChamaFactory, MockCUSD
│   │   ├── contracts/     .sol sources
│   │   ├── test/          9/9 tests passing
│   │   ├── scripts/       deploy / deploy-factory / setup-members / demo /
│   │   │                  inspect / register-agent / gen-wallet
│   │   ├── deployments/   per-chain JSON dumps (addresses, members, etc.)
│   │   └── agent-card.json   ERC-8004 AgentCard (hosted on raw.githubusercontent)
│   ├── agent/             autonomous TS cron service
│   │   ├── src/index.ts   multi-chama operator (factory + seed)
│   │   ├── Dockerfile     for Fly.io / Railway / any container host
│   │   ├── fly.toml       one-command Fly deploy
│   │   └── railway.json   Railway config
│   └── web/               Vite + React 19 dashboard
│       └── src/
│           ├── routes/    Landing · ChamaDetail · Create
│           ├── components/Hero · RotationVisualizer · MemberActions ·
│           │              CreateChamaForm · SelfVerificationCard …
│           └── hooks/     useChamaState · useChamaActivity ·
│                          useFactoryChamas · useSelfVerification
└── .env.example           copy to .env, populate via `pnpm gen-wallet`
```

## Quick start

```bash
# 1. install
pnpm install

# 2. generate fresh testnet wallets (deployer + 3 members) — paste into .env
pnpm --filter @chama/contracts gen-wallet
cp .env.example .env       # then fill in the keys + addresses

# 3. fund all 4 wallets at https://faucet.celo.org/celo-sepolia

# 4. compile + run all 9 contract tests
pnpm --filter @chama/contracts test

# 5. deploy MockCUSD + a seed Chama + the ChamaFactory
pnpm --filter @chama/contracts deploy:sepolia
pnpm --filter @chama/contracts deploy-factory:sepolia

# 6. (optional) one-time member setup for the seed chama
pnpm --filter @chama/contracts setup:sepolia

# 7. launch the autonomous agent (operates the seed + every factory chama)
pnpm --filter @chama/agent dev

# 8. (separate terminal) launch the dashboard
pnpm --filter @chama/web dev    # http://localhost:3000
```

For a manual rotation (no agent), use `pnpm --filter @chama/contracts demo:sepolia`. For a state dump, `pnpm --filter @chama/contracts inspect:sepolia`. Register or re-register the agent on ERC-8004 with `pnpm --filter @chama/contracts register-agent` after setting `AGENT_CARD_URI`.

## Tech

| Layer | Stack |
|---|---|
| Contracts | Solidity 0.8.24 · Hardhat 2 + hardhat-toolbox · OpenZeppelin ERC20 · 9/9 tests |
| Agent | TypeScript 5.6 (ESM) · viem 2 with fallback transport across forno + drpc + thirdweb · pino |
| Web | Vite 6 · React 19 · Tailwind v4 (CSS-config) · framer-motion 11 · wagmi v2 · RainbowKit v2 · @tanstack/react-query · react-router-dom v7 · lucide-react · Geist + Instrument Serif typography |
| Identity | Self Protocol (`@selfxyz/qrcode`, `@selfxyz/core`) — staging_celo mode against the IdentityVerificationHub |
| Agent identity | ERC-8004 Identity Registry (Celo Sepolia 0x8004A8…BD9e) — Agent #274 |
| Hosting | Multi-stage Dockerfile · Fly.io · Railway |

## ERC-8004

- **Identity Registry (Celo Sepolia):** `0x8004A818BFB912233c491871b3d84c89A494BD9e`
- **AgentCard:** [`packages/contracts/agent-card.json`](./packages/contracts/agent-card.json) — served from this repo via `raw.githubusercontent.com`. Spec-compliant: `type`, `services` (not deprecated `endpoints`), `image`, `registrations`, `active`.
- **Registered ChamaAgent:** [agent ID 274 on 8004scan](https://8004scan.io/agents/celo-sepolia/274) · [registration tx](https://celo-sepolia.blockscout.com/tx/0xc93704898c996202109c1567985db6fa8eb5e81702870a087657c90fc88bd04e)
- **Identity icon:** [icon.svg](./packages/contracts/icon.svg) — three nodes connected by rotation arrows

Re-register after AgentCard updates via `pnpm --filter @chama/contracts register-agent`.

## Self ID

Each chama creator verifies humanity via Self before the form unlocks. The UI uses `@selfxyz/qrcode`'s `SelfQRcodeWrapper` against the **IdentityVerificationHub at `0x16ECBA51e18a4a7e61fdC417f0d47AFEeDfbed74`** (Celo Sepolia, staging mode with mock passports). Disclosures: OFAC check + proof-of-humanity only — no PII surfaces to the dapp.

Currently the verification result is held in `localStorage` per wallet (MVP). The next milestone is a thin `ChamaVerifiedRegistry` contract that consumes Self's on-chain proof callback and exposes `mapping(address => bool)` so the `Chama` contract itself can gate membership trustlessly. On mainnet, the hub is `0xe57F4773bd9c9d8b6Cd70431117d353298B9f5BF`.

## Hosting the agent

```bash
# Fly.io
fly launch --copy-config --no-deploy
fly secrets set DEPLOYER_PRIVATE_KEY=0x...
fly deploy --dockerfile packages/agent/Dockerfile

# Railway
# Connect repo → point at packages/agent/Dockerfile → set DEPLOYER_PRIVATE_KEY → deploy
```

The agent is a pure background worker (no HTTP). Memory footprint <100MB. See [`packages/agent/README.md`](./packages/agent/README.md) for details.

## Roadmap

Already shipped:
- [x] Per-group `Chama.sol` escrow + 5 tests
- [x] `ChamaFactory.sol` for permissionless chama creation + 4 tests
- [x] Autonomous TS cron agent (operates many chamas simultaneously)
- [x] Web dashboard: Landing + ChamaDetail + Create routes, live RotationVisualizer, animated member cards, activity feed, countdown ring
- [x] Wallet connect (wagmi v2 + RainbowKit v2)
- [x] Member self-serve (mint test mcUSD + approve chama from the UI)
- [x] ERC-8004 Identity Registry registration (Agent #274, AgentCard hosted on GitHub raw, spec-compliant)
- [x] Self Protocol QR verification (UI level, MVP)
- [x] Dockerfile + Fly.io + Railway configs

Next:
- [ ] `ChamaVerifiedRegistry` contract that on-chain-gates membership behind Self verification callback
- [ ] Mainnet deployment (real cUSD at `0x765DE8…`, agent paid in CELO gas, 24/7 on Fly.io)
- [ ] MiniPay mini-app — Telegram-style flow inside MiniPay's UI
- [ ] ERC-8004 Reputation Registry — per-cycle members post a positive attestation against the agent, lifting its 8004scan rank
- [ ] EIP-2612 permit-based contributions — members sign once, agent pays gas for every cycle
- [ ] Yield on idle pot — route pre-payout balances into Mento / Moola
- [ ] ChamaFactory event-driven discovery (replace the current poll)

## License

MIT
