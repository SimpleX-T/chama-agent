import { useEffect } from "react";
import { motion } from "framer-motion";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { CheckCircle2, Coins, Loader2, ShieldCheck, Sparkles } from "lucide-react";
import { maxUint256 } from "viem";
import { useAccount, useReadContract, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { CUSD_ADDR, chamaAbi, erc20Abi, mockCUSDAbi } from "@/lib/chain";
import { cn } from "@/lib/cn";
import { formatUnits } from "@/lib/format";
import { useSelfVerification } from "@/hooks/useSelfVerification";

type Props = {
  chamaAddress: `0x${string}`;
  contribution: bigint;
};

/**
 * Self-serve panel for the connected wallet:
 *  - If not connected → "connect wallet" prompt
 *  - If connected but not a member → status badge
 *  - If member, no balance → mint test mcUSD
 *  - If member, balance, no allowance → approve the chama
 *  - If member, balance + allowance → ready (agent will operate)
 */
export function MemberActions({ chamaAddress, contribution }: Props) {
  const { address, isConnected } = useAccount();
  const { verified } = useSelfVerification();

  // Membership check
  const { data: isMember } = useReadContract({
    address: chamaAddress,
    abi: chamaAbi,
    functionName: "members",
    query: { enabled: isConnected },
  });

  const memberHit = address
    ? (isMember as readonly `0x${string}`[] | undefined)?.some(
        (m) => m.toLowerCase() === address.toLowerCase(),
      )
    : false;

  const { data: balance, refetch: refetchBal } = useReadContract({
    address: CUSD_ADDR,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const { data: allowance, refetch: refetchAllow } = useReadContract({
    address: CUSD_ADDR,
    abi: erc20Abi,
    functionName: "allowance",
    args: address ? [address, chamaAddress] : undefined,
    query: { enabled: !!address },
  });

  // Write hooks
  const { writeContract: mintWrite, data: mintHash, isPending: mintPending } = useWriteContract();
  const { isLoading: mintMining, isSuccess: mintDone } = useWaitForTransactionReceipt({ hash: mintHash });

  const { writeContract: approveWrite, data: approveHash, isPending: approvePending } = useWriteContract();
  const { isLoading: approveMining, isSuccess: approveDone } = useWaitForTransactionReceipt({ hash: approveHash });

  useEffect(() => {
    if (mintDone) refetchBal();
  }, [mintDone, refetchBal]);
  useEffect(() => {
    if (approveDone) refetchAllow();
  }, [approveDone, refetchAllow]);

  if (!isConnected) {
    return (
      <PanelShell
        icon={<Sparkles className="size-5" />}
        title="Connect to participate"
        body="Connect a wallet that's a member of this chama to fund yourself with test mcUSD and authorize the contract."
      >
        <div className="rk-only">
          <ConnectButton label="Connect wallet" showBalance={false} accountStatus="address" />
        </div>
      </PanelShell>
    );
  }

  if (!memberHit) {
    return (
      <PanelShell
        icon={<ShieldCheck className="size-5" />}
        title="Spectator mode"
        body="The wallet you connected isn't a member of this chama. You can watch the rotation but can't participate."
      />
    );
  }

  const bal = (balance as bigint | undefined) ?? 0n;
  const allow = (allowance as bigint | undefined) ?? 0n;
  const needFromFaucet = bal < contribution;
  const needApprove = allow < contribution;
  const ready = !needFromFaucet && !needApprove;

  const onMint = () => {
    if (!address) return;
    mintWrite({
      address: CUSD_ADDR,
      abi: mockCUSDAbi,
      functionName: "mint",
      args: [address, contribution * 10n],
    });
  };
  const onApprove = () => {
    approveWrite({
      address: CUSD_ADDR,
      abi: erc20Abi,
      functionName: "approve",
      args: [chamaAddress, maxUint256],
    });
  };

  return (
    <PanelShell
      icon={<Coins className="size-5" />}
      title={ready ? "You're set up" : "Get ready to participate"}
      body={
        ready
          ? "Balance and approval are in place. The agent will pull your contribution when the cycle window opens."
          : "Two one-time steps: mint test mcUSD and approve the chama contract to spend it. Real cUSD on mainnet."
      }
    >
      {verified && (
        <div className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-[oklch(0.78_0.18_152/0.4)] bg-[oklch(0.78_0.18_152/0.08)] px-2.5 py-1 text-[10px] uppercase tracking-wider text-[oklch(0.78_0.18_152)]">
          <CheckCircle2 className="size-3" />
          Self verified
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2 mt-1">
        <StepCard
          step={1}
          title="Fund"
          done={!needFromFaucet}
          value={`${formatUnits(bal)} mcUSD`}
          actionLabel={needFromFaucet ? "Mint test mcUSD" : "Funded"}
          loading={mintPending || mintMining}
          onClick={onMint}
        />
        <StepCard
          step={2}
          title="Approve"
          done={!needApprove}
          value={
            allow > 10n ** 30n
              ? "Unlimited"
              : allow > 0n
                ? `${formatUnits(allow)} mcUSD`
                : "Not approved"
          }
          actionLabel={needApprove ? "Approve chama" : "Approved"}
          loading={approvePending || approveMining}
          onClick={onApprove}
          disabled={needFromFaucet}
        />
      </div>
    </PanelShell>
  );
}

function PanelShell({
  icon,
  title,
  body,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  children?: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="surface p-6 sm:p-7"
    >
      <div className="flex items-start gap-4">
        <span
          className="grid size-11 place-items-center rounded-xl text-[var(--color-accent)] shrink-0"
          style={{ background: "var(--color-accent-soft)" }}
        >
          {icon}
        </span>
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
          <p className="mt-1.5 text-sm text-[var(--color-fg-muted)] leading-relaxed text-pretty">
            {body}
          </p>
          {children && <div className="mt-5">{children}</div>}
        </div>
      </div>
    </motion.div>
  );
}

function StepCard({
  step,
  title,
  done,
  value,
  actionLabel,
  loading,
  onClick,
  disabled,
}: {
  step: number;
  title: string;
  done: boolean;
  value: string;
  actionLabel: string;
  loading: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border bg-black/40 px-4 py-4 transition",
        done
          ? "border-[oklch(0.78_0.18_152/0.4)]"
          : "border-[var(--color-border)] hover:border-[var(--color-border-strong)]",
      )}
    >
      <div className="flex items-center justify-between text-xs">
        <span className="font-mono text-[var(--color-fg-subtle)]">STEP {step}</span>
        <span
          className={cn(
            "text-[10px] uppercase tracking-wider",
            done ? "text-[oklch(0.78_0.18_152)]" : "text-[var(--color-fg-subtle)]",
          )}
        >
          {done ? "✓ done" : "needed"}
        </span>
      </div>
      <div className="mt-2 text-base font-semibold">{title}</div>
      <div className="mt-0.5 text-xs nums text-[var(--color-fg-muted)]">{value}</div>
      {!done && (
        <button
          type="button"
          onClick={onClick}
          disabled={disabled || loading}
          className={cn(
            "mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-md text-xs font-semibold py-2 transition",
            disabled
              ? "bg-white/[0.04] text-[var(--color-fg-subtle)] cursor-not-allowed"
              : "bg-[var(--color-accent)] text-[#09090b] hover:brightness-110 disabled:opacity-60",
          )}
        >
          {loading && <Loader2 className="size-3.5 animate-spin" />}
          {actionLabel}
        </button>
      )}
    </div>
  );
}
