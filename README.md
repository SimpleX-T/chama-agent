# ChamaAgent

**Trustless rotating savings groups (ROSCA / chama / ajo / esusu) on Celo — operated by an autonomous on-chain agent.**

A chama is a savings group where each member contributes a fixed amount every cycle, and the full pot rotates to one member per cycle until every member has been paid once. Tens of millions of people in Kenya, Nigeria, South Africa, and across the diaspora use these informally; the bookkeeping and disbursement is the bottleneck.

ChamaAgent puts the chama on-chain:

- **Members verified via Self Agent ID** (ZK passport-proof — sybil-resistant without exposing PII).
- **A Solidity escrow contract holds cUSD** in a per-chama instance. The agent has _no_ custodial control — it can only trigger workflow steps the contract permits.
- **The agent (ERC-8004 registered)** runs as a cron service: it calls `contributeFor(member)` once each member's allowance is in place, and `executePayout()` once the cycle is satisfied. Every step is on-chain, auditable, and reversible only by the rules the contract enforces.
- **Native to MiniPay** (15M+ wallets across 66 countries) — built so the same flow can run inside a MiniPay mini-app on mainnet.

Submitted to:

- **Celo Proof of Ship — May 2026** (AI Track)
- **Celo Onchain Agents Hackathon 2026** — tracking all three prize pools (Best Agent · Most Activity · Highest 8004scan Rank)

## How it works

```
              ┌──────────────────┐
              │   Self Agent ID  │  (mainnet stretch)
              │  ZK passport KYC │
              └────────┬─────────┘
                       │ identity attestation
                       ▼
   ┌─────────────────────────────────────────────┐
   │              Chama.sol  (per group)         │
   │  • cUSD escrow (no agent custody)           │
   │  • members[], cycle counter, deadlines      │
   │  • contributeFor(member) — permissionless   │
   │  • executePayout() — agent-gated, push pay  │
   └────────┬────────────────────────────┬───────┘
            │ events                     │ writes
            ▼                            ▼
   ┌────────────────────┐    ┌─────────────────────────┐
   │   Web dashboard    │    │   ChamaAgent service    │
   │  (Vite + viem)     │    │   (TS + viem, cron)     │
   │  realtime state    │    │   ERC-8004 registered   │
   └────────────────────┘    └─────────────────────────┘
```

**Trust model:** the agent has zero financial trust. Members approve the Chama contract directly (not the agent) for cUSD spend. The agent's key only signs `contributeFor()` and `executePayout()` calls — and the contract enforces invariants (one contribution per cycle, agent-only payout, fixed payout order). If the agent goes offline, any member can call `contributeFor()` themselves to keep the chama liquid. Self-recovering by design.

## Live on Celo Sepolia (testnet)

| Contract | Address | Explorer |
|---|---|---|
| Chama (3-member demo, 1 mcUSD/cycle, 5-min cycles) | `0xe68552774266A758c92A24Bb13F289d9360276aC` | [view](https://celo-sepolia.blockscout.com/address/0xe68552774266A758c92A24Bb13F289d9360276aC) |
| MockCUSD | `0x3A38E894A31d716AdA6Fd6ECc0Ff2344BD08D638` | [view](https://celo-sepolia.blockscout.com/address/0x3A38E894A31d716AdA6Fd6ECc0Ff2344BD08D638) |
| Agent wallet | `0x7E65877b560Db3863baB4BC32F60e3c6693a9B06` | [view](https://celo-sepolia.blockscout.com/address/0x7E65877b560Db3863baB4BC32F60e3c6693a9B06) |
| **ERC-8004 Agent ID** | **#274** | [**8004scan**](https://8004scan.io/agents/celo-sepolia/274) |

The deployed chama above has already completed a full 3-member rotation — every member contributed 3× and was paid out once. See the contract address page for the full event log.

## Repo layout

```
chama-agent/
├── packages/
│   ├── contracts/   Solidity (Hardhat) — Chama.sol, MockCUSD.sol, deploy/setup/demo scripts
│   ├── agent/       TypeScript cron service (viem) — autonomous rotation driver
│   └── web/         Vite + React 19 dashboard (read-only, polls on-chain state)
├── agent-card.json  ERC-8004 AgentCard (referenced by Identity Registry)
└── .env.example     copy to .env, populate via `pnpm gen-wallet`
```

## Quick start

```bash
# 1. install
pnpm install

# 2. generate fresh testnet wallets (deployer + 3 members) — paste into .env
pnpm --filter @chama/contracts gen-wallet
cp .env.example .env  # fill in the values from above

# 3. fund all 4 wallets at https://faucet.celo.org/celo-sepolia

# 4. compile + test contracts
pnpm --filter @chama/contracts test

# 5. deploy a fresh chama to Celo Sepolia
pnpm --filter @chama/contracts deploy:sepolia

# 6. one-time member setup (mints mock cUSD, approves chama contract)
pnpm --filter @chama/contracts setup:sepolia

# 7. launch the autonomous agent — it will run a full rotation in ~30-60s
pnpm --filter @chama/agent dev

# 8. (separate terminal) launch the dashboard
pnpm --filter @chama/web dev   # http://localhost:3000
```

For a manual rotation (no agent), use `pnpm --filter @chama/contracts demo:sepolia`. For a state dump of the current chama, `pnpm --filter @chama/contracts inspect:sepolia`.

## Tech

- **Solidity 0.8.24** · OpenZeppelin ERC20
- **Hardhat 2** + hardhat-toolbox · 5/5 contract tests in `packages/contracts/test`
- **viem 2** · agent service + dashboard
- **TypeScript 5.6** · ESM throughout
- **React 19 + Vite 6 + Tailwind CDN** · dashboard
- **pnpm workspaces**

## ERC-8004

- **Identity Registry (Celo Sepolia):** `0x8004A818BFB912233c491871b3d84c89A494BD9e`
- **AgentCard:** [`packages/contracts/agent-card.json`](./packages/contracts/agent-card.json)
- **Registered ChamaAgent:** [agent ID 274 on 8004scan](https://8004scan.io/agents/celo-sepolia/274) · [registration tx](https://celo-sepolia.blockscout.com/tx/0xc93704898c996202109c1567985db6fa8eb5e81702870a087657c90fc88bd04e)

Re-register (e.g. after AgentCard updates) via `pnpm --filter @chama/contracts register-agent` (requires `AGENT_CARD_URI` in `.env`).

## Roadmap (post-Proof-of-Ship, before hackathon close)

- [ ] **Self Agent ID gating** — each member's join verified through Self's ZK passport proof
- [ ] **ChamaFactory** — single deployer for many concurrent chamas, agent watches the factory
- [ ] **Mainnet deployment** — real cUSD at `0x765DE8...`, agent paid in CELO gas
- [ ] **MiniPay mini-app** — Telegram-style flow for joining, viewing, and getting paid
- [ ] **Reputation attestations** — per-cycle, members attest to the agent on the ERC-8004 Reputation Registry
- [ ] **Permit-based contributions** — members sign EIP-2612 permits once, agent debits without gas costs to members
- [ ] **Yield on idle pot** — route undisbursed funds into Mento / Moola for the day they sit

## License

MIT
