# ChamaAgent Hackathon Submission

## Project

**ChamaAgent** is an ERC-8004 registered onchain agent for trustless rotating savings groups on Celo. It replaces the informal treasurer in a chama / ajo / esusu group with a per-group cUSD escrow contract and an autonomous agent that advances contributions and payouts.

## One-liner

Trustless rotating savings groups on Celo: members approve a cUSD escrow, Self verifies humanity, and an ERC-8004 agent rotates the pot onchain without ever taking custody.

## Hackathon fit

- **Real-world payments:** ROSCAs are everyday savings infrastructure across Africa, Latin America, Asia, and diaspora communities; ChamaAgent maps that behavior directly to cUSD.
- **Onchain agent:** ERC-8004 Agent #9146 operates cycle execution on Celo mainnet and Agent #274 remains available on Celo Sepolia for demos.
- **Genuine utility:** users can create new groups, approve cUSD, contribute, receive payouts, and post reputation feedback to the ERC-8004 Reputation Registry.
- **Non-custodial safety:** members approve the Chama contract, not the agent. The agent can trigger workflow functions only; contract invariants enforce all fund movement.
- **Everyday access:** MiniPay detection and mobile web hints are built in for the 15M+ MiniPay user base.

## Required links

| Item | Link |
|---|---|
| Source code | https://github.com/SimpleX-T/chama-agent |
| ERC-8004 / 8004scan mainnet agent | https://8004scan.io/agents/celo/9146 |
| ERC-8004 / 8004scan Sepolia agent | https://8004scan.io/agents/celo-sepolia/274 |
| AgentCard URI | https://raw.githubusercontent.com/SimpleX-T/chama-agent/main/packages/contracts/agent-card.json |
| Celo mainnet factory | https://celoscan.io/address/0x8cA82b18093880524f9EAbEf1bEFE5B864032918 |
| Celo mainnet verifier | https://celoscan.io/address/0x90D6641808b8Ff80DF43269ad094491AA4383B67 |
| Agent wallet | https://celoscan.io/address/0x60347C5337480460B7E274A3C05eBE445ec0b0b9 |
| Mainnet registration tx | https://celoscan.io/tx/0x15aa52c40768367a5e36b9c9475ef8532dd9b814731a7654e1de54b5608ce6a4 |

## Suggested tweet

I am building for the @CeloDevs Agent Hackathon.

Working on: ChamaAgent — an ERC-8004 agent for trustless rotating savings groups on Celo. Members approve cUSD escrow contracts, Self verifies humanity, and the agent rotates payouts onchain without custody.

Registered onchain: https://8004scan.io/agents/celo/9146

@Celo @CeloDevs #CeloAgents

## Demo notes for judges

- Connect a Celo-compatible wallet or MiniPay.
- The app defaults to Celo mainnet and can also run against Celo Sepolia for mock-passport demos.
- On mainnet, Self requires a real passport through the Self mobile app. The app supports an allowlist bypass for the project owner / judges when configured through `VITE_SELF_BYPASS_WALLETS`.
- On Sepolia, mock passports and mock cUSD are supported for faster demonstration.

## Submission checklist

- [x] ERC-8004 mainnet agent registered.
- [x] AgentCard hosted and linked from registration.
- [x] Celo mainnet contracts deployed with real cUSD.
- [x] Self verification flow integrated.
- [x] MiniPay detection integrated.
- [x] ERC-8004 reputation feedback flow included.
- [x] README includes architecture, live addresses, trust model, and quick start.
- [x] Submit through the Celo Builders Skill flow.
- [x] Post registration/submission tweet from the participant account.
- [x] Add deployed web app URL if it differs from the repository URL.
