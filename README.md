# 🚀 Launch A Pool Wizard


![Build Status](https://codebuild.eu-central-1.amazonaws.com/badges?uuid=eyJlbmNyeXB0ZWREYXRhIjoianZGTDFDc0ozQTVWSVliRzE5cVpRbzUzMXFuTURCSlhXSzh6aHVIbGdmK0ZrcU9ROWdZM0JpM2xZSG04MmZEelBGU1VtWHV0ZGcyb2lWYmRLK2s3NEtFPSIsIml2UGFyYW1ldGVyU3BlYyI6ImpMUE9uRGZKb3p1SXVqOFIiLCJtYXRlcmlhbFNldFNlcmlhbCI6MX0%3D&branch=dev)

This badge displays the **current build status of the `dev` branch** powered by **AWS CodeBuild**.

### Status meanings
- **Green (Passing)** ✅ — The latest commit on `dev` built successfully.
- **Red (Failing)** ❌ — The build failed. Please review the CodeBuild logs.
- **Running** ⏳ — A build is currently in progress.

### How it works
- Every push or pull request targeting the `dev` branch triggers an AWS CodeBuild pipeline.
- The pipeline typically runs:
  - Dependency installation
  - Tests
  - Project build steps
- The badge updates automatically after each run.

### Why this matters
- Provides quick visibility into the health of the `dev` branch
- Helps catch issues early before merging or deployment
- Improves confidence for contributors and reviewers

> **Note:** If the badge is red, please fix the build before opening or merging pull requests.

## 📌 Overview

This repository provides a **frontend interface for deploying and interacting with a custom ReFi Pool smart contract on Solana**.

It includes:

* 🧙 **Pool Wizard** – Create and deploy new pools
* ⚙️ **Custom Hooks** – Encapsulated logic for actions and balances
* 💰 **User Actions** – Deposit, withdraw, and balance tracking
* 🔗 **SDK Integration** – Interaction with on-chain programs
* 🧠 **State + LocalStorage Sync** – Persist deployed pool data

---

# 🧱 Architecture

## 1. Pool Wizard (Deployment Flow)

The **Pool Wizard** allows users to deploy a new pool via a guided UI.

### Flow:

1. User inputs:

   * Pool name
   * Symbol
   * APY
   * Pool ID

2. `handleDeploy()` executes:

   * `initPool`
   * `initPoolStep2`
   * `initWallets`

3. On success:

   * Save to `localStorage`
   * Update React state (`poolAddress`)
   * Switch UI to dashboard

### Stored Data

```json
{
  "walletAddress": "...",
  "vaultContractAddress": "..."
}
```

---

## 2. State Management Strategy

### Key Principle:

> `localStorage` = persistence
> React state = UI source of truth

### Important Patterns:

* Load from `localStorage` in `useEffect` (avoid SSR issues)
* Update state immediately after deployment
* Never rely on `localStorage` alone for UI updates

---

### 🔹 `useVoltActions`

Handles:

* Deposit
* Withdraw (optional)
* Fee calculations
* Derived values

#### Features:

* Safe handling of `poolPda`
* Memoized calculations (`useMemo`)
* Async transaction execution

#### Key Outputs:

```ts
{
  amountDeposit,
  setAmountDeposit,
  minReceiveDeposit,
  deposit,
  loading
}
```

---

### 🔹 `useVoltBalances`

Handles:

* Fetching USDC balance
* Fetching VOLT balance
* Loading state

#### Core Logic:

```ts
const fetchBalances = async () => {
  if (!poolPda || !sdk) return;

  const usdcBalance = await sdk.getTokenBalance(USDC_MINT);
  const iptBalance = await sdk.getTokenBalance(iptMint);

  setDepositBalance(...)
  setBalanceVOLT(...)
};
```

#### Notes:

* Must be manually triggered OR auto-triggered via `useEffect`
* Requires valid `poolPda`

---

### 🔹 `useInitProgramSdk`

Creates a memoized SDK instance.

#### Responsibilities:

* Initialize Solana `Connection`
* Bind wallet context
* Create SDK instance

#### Important:

```ts
new Connection(url, 'confirmed')
```

Ensures consistent RPC reads.

---

## 4. Pool Dashboard

Displayed after deployment.

### Features:

* Deposit UI
* Balance display
* Transaction feedback

### Data Dependencies:

* `poolAddress`
* `useVoltBalances`
* `useVoltActions`

---

## 5. Deposit Flow

### Flow:

1. User inputs amount
2. Calls:

```ts
await actions.deposit()
```

3. On success:

* Reset input
* Refetch balances

---

### ⚠️ Important Notes

#### 1. RPC Delay

* Blockchain state may not update instantly
* Even after confirmation

#### 2. Solution

```ts
await balances.fetchBalances()
```

Optionally retry:

```ts
for (let i = 0; i < 5; i++) {
  await balances.fetchBalances();
  await sleep(1500);
}
```

---

## 6. Withdraw Flow (Optional)

Structure is similar to deposit:

* Uses `sdk.userWithdraw`
* Requires IPT mint derivation
* Applies withdrawal fee

---

## 7. Smart Contract Integration

The frontend interacts with a **custom Solana program** via SDK.

### Key Instructions:

* `initPool` → create pool
* `initPoolStep2` → finalize setup
* `initWallets` → initialize vaults
* `userDeposit` → deposit funds
* `userWithdraw` → withdraw funds

# 🎯 Summary

This repo provides a full-stack interaction layer for a **custom Solana pool protocol**, featuring:

* A guided **Pool Wizard**
* Clean **hook-based architecture**
* Robust **state + RPC handling**
* Scalable **SDK integration**

---

If you’re extending this:

* Focus on **real-time updates**
* Improve **UX after transactions**
* Optimize **data fetching strategy**

---

Happy building 🚀
