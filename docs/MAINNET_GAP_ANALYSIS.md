# Shield Finance mainnet-readiness gap analysis

**Date:** 18 November 2026
**Scope:** Read-only review of this repository plus current Flare, Firelight, Kinetic, and Upshift contracts and docs. No contracts were modified and nothing was deployed.
**Audience:** Rami, who plans to write and finish the vault and strategy contracts himself.
**Status of this document:** A first-pass engineering gap analysis. It is not an external audit, and it is not a sign-off for mainnet.

The product path is XRP → FXRP (FAssets) → `ShXRPVault` → shXRP, with planned yield in Firelight and Kinetic, a liquidity buffer, a SHIELD token, a `RevenueRouter`, and `StakingBoost`.

The design constraint for every recommendation below is the 18 November 2026 failure of Upshift's Monarq FXRP vault on Flare (`0x2439D4bb753A0f3777d4C9011AFacc475ba6B951`). Matured withdrawal claims reverted with `FAssetBalanceTooLow` because almost all FXRP had been deployed off-vault. At analysis time the vault's on-chain FXRP balance was **48,553.659846 FXRP** (6 decimals, `FXRP.balanceOf` on `0xAd552A648C74D49E10027AB8a618A3ad4901c5bE`). The Upshift app at the same time showed **5.06M FXRP TVL** and a share price of 0.9982 (page updated 11/18/2026, 3:16 AM). Idle cash was below matured claims (about 56.9k FXRP). `FAsset._beforeTokenTransfer` reverts the whole transfer when `balanceOf(from) < amount`. There is no partial payout. Users got a revert, no remaining balance, and no on-chain ETA.

Shield's current vault can reach the same state. The 10% buffer is a target the operator may ignore. A withdrawal that cannot be filled in one transaction reverts. `pause()` freezes exits.

---

## How to read the priorities

| Label | Meaning |
| --- | --- |
| Blocker | Mainnet with user funds is unsafe until this is fixed in the contract that holds the assets. |
| Required before TVL | Must ship with v1, can follow the liquidity rewrite. |
| Later | Keep out of the first release. |

Effort is relative size of the change, for one person who already knows this repo:

| Size | What it means |
| --- | --- |
| S | One contract, localized, plus tests. |
| M | A contract plus fork tests, scripts, or a keeper. |
| L | A new subsystem (queue, adapter, or operational stack). |

---

## 1. Inventory

Nothing in `contracts/` is upgradeable. There is no `Initializable`, UUPS, or transparent proxy. A Coston2 bug cannot be patched in place. Mainnet must be a new deployment. The last recorded Coston2 deploy is `deployments/coston2-latest.json` at **2025-11-23T04:51:47Z**, deployer `0x105A22E3fF06ee17020A510fa5113B5C6d9FEb2D`. The last git commit on `main` is **2025-12-29** (`0825423`). The tree has been idle for about eleven months.

Coston2 bytecode is still present for the vault `0x3219232a45880b79736Ee899Cb3b2f95D527C631` (19,307 bytes) and the documented MockStrategy `0x1a8c6d2BfD132bCf75B54B3d23CA4c0542957A45` (4,473 bytes). That testnet used MockStrategy, not Firelight or Kinetic.

### 1.1 Production-intended contracts

| Contract | Lines | Purpose | Upgradeable | Who can move value | Tests that actually ran |
| --- | --- | --- | --- | --- | --- |
| `contracts/ShXRPVault.sol` | 1,692 | ERC-4626 vault. Asset FXRP, shares shXRP. Holds the buffer, deploys to strategies, takes 0.2% deposit and withdraw fees, accrues a yield fee. | No. `Ownable`. | **Owner:** operators, strategies, allocations, buffer target, deposit limit, min deposit, yield fee (max 5%), pause, unpause, one-time `setStakingBoost`. **Operator** (owner is also an operator): `deployToStrategy`, `withdrawFromStrategy`, `pauseStrategy`, `claimAccruedFees`. **Anyone:** `reportStrategy`. | `test/ShXRPVault.test.ts` passed (99 cases). `test/ShXRPVault.MultiStrategy.test.ts` did not run: constructor arity is stale. |
| `contracts/VaultController.sol` | 800 | Off-vault coordinator. Registers vaults, records bridge requests, compounds, and rebalances toward 10/40/50. The 10% check lives only here. | No. `AccessControl`. | `DEFAULT_ADMIN_ROLE` grants `OPERATOR_ROLE` and `COMPOUNDER_ROLE`, registers vaults and strategies, sets the XRP→FXRP rate (up to 110%). Operators create bridge rows and call deploy/rebalance. Compounders call `executeCompound`. | 13 cases in `test/VaultController.test.ts`. 4 failed (see §1.4). |
| `contracts/FirelightStrategy.sol` | 336 | Pulls FXRP and calls Firelight `deposit` / `redeem`. | No. `AccessControl`. | `DEFAULT_ADMIN_ROLE`: set the stXRP vault, activate, `emergencyWithdraw`, `rescueTokens` (can move stXRP once deactivated, and can move any other token including idle FXRP while active). `OPERATOR_ROLE`: `deploy`, `withdraw`, `report`. Constructor grants both roles to the addresses passed in. The mainnet script also grants the vault the operator role, and leaves the deployer as operator. | No dedicated test. `test/integration/FirelightIntegration.test.ts` is `this.skip()`. |
| `contracts/KineticStrategy.sol` | 276 | Intended Compound-style lender. `deploy` only `transferFrom`s FXRP and holds it. `mint` / `redeem` are TODOs. `simulateYield` adds to `accumulatedYield` with no tokens. | No. Same role split as Firelight. | Operator can call `simulateYield`, which increases `totalAssets()` with no FXRP. Admin `emergencyWithdraw` is a no-op. | None. |
| `contracts/StakingBoost.sol` | 614 | Lock SHIELD for 30 days. `distributeBoost` accounts FXRP rewards. `claim` approves the vault and calls `donateOnBehalf`, which mints shXRP. `getBoost` is +100 bps per 100 SHIELD, default cap 2,500 bps, owner can raise the cap to 10,000. | No. `Ownable`. | Owner: set router, set cap, `setTestnetLockBypass` (enable only when `block.chainid == 114`), `recoverTokens`. FXRP recovery is capped by `getRecoverableFxrp`. SHIELD recovery cannot touch `totalStaked`. | `test/StakingBoost.test.ts` and `test/StakingBoost.Adversarial.test.ts` failed in `beforeEach` (constructor drift). The Asfalia cases in `test/AuditRemediation.test.ts` did run. |
| `contracts/RevenueRouter.sol` | 373 | Holds FXRP fees. `distribute()` is permissionless: default 50% swap to SHIELD and burn, 40% to `StakingBoost`, 10% left as reserves. Router is an immutable SparkDEX V3 router. Pool fee is hardcoded at 0.3%. | No. `Ownable`. | Owner: allocations (each max 80%, sum max 100%), slippage (max 20%), `lastKnownPrice`, `withdrawReserves` for any FXRP amount, `rescueTokens` for every token except FXRP. | `test/RevenueRouter.test.ts` passed. `test/RevenueRouter.Security.test.ts` did not run. |
| `contracts/BuybackBurn.sol` | 168 | Separate wFLR → SHIELD burn path. Not on the FXRP fee path. | No. `Ownable`. | Owner: slippage (max 20%), price, `rescueTokens` (blocks wFLR and SHIELD). Anyone: `buyAndBurn`. | `test/BuybackBurn.test.ts` passed. |
| `contracts/ShieldToken.sol` | 63 | Fixed 10,000,000 SHIELD, 18 decimals, all minted to the deployer. Burnable. No owner, no pause, no tax. | No. | Deployer receives the entire supply. After that, holders only. | `test/ShieldToken.test.ts` and the ST cases in the audit file passed. |
| `contracts/MerkleDistributor.sol` | 197 | One-shot merkle airdrop. Root is immutable. | No. `Ownable`. | Owner can `withdraw` unclaimed tokens to any non-zero address. | Both merkle test files passed. |

`ShXRPVault` does not use `AccessControl`. The checklist's `ADMIN_ROLE` / `STRATEGY_ROLE` / `FEE_MANAGER_ROLE` are not in the contract. Authority is `Ownable` plus an `operators` mapping.

### 1.2 Contracts that should not ship with v1

| Contract | Why it is in the tree | Access | Test coverage |
| --- | --- | --- | --- |
| `contracts/ShieldV2Taxes.sol` (451 lines, solc 0.8.10) | A separate tax token: trading switch, fee wallets, `removeLimits`, `removeTokens`. This is not `ShieldToken`. | Owner can change fees and pull tokens. | None. Do not deploy. |
| `contracts/layerzero/ShieldOFT.sol`, `ShieldOFTAdapter.sol` | Hand-written LayerZero V2 OFT, not the official OFT implementation. Owner can pause, set peers, and `emergencyWithdraw` tokens. | Owner. | No contract tests found. |
| `contracts/presale/ShieldPresale.sol`, `ZapPresale.sol` | Four-stage presale, vesting, merkle allowlist, referrals. Coston2 addresses are in `deployments/coston2/presale.json` and `replit.md`. | Owner, pausable. | No Hardhat file ran against them in this pass. |
| `contracts/test/MockStrategy.sol`, `contracts/mocks/*` | Testnet and unit-test doubles. `setYieldAmount` fabricates yield. | Test admin. | Used by the vault tests that pass. The multi-strategy file still deploys the old constructor and does not run. |

### 1.3 What the docs claim versus what is in the repo

`docs/protocol/SHIELD_SECURITY_CHECKLIST.md` (last security review it records: 6 December 2025) marks all of the following done:

- External audit by a reputable firm, report published, findings closed on **28 November 2025**.
- 527 tests passing, including 164 `ShXRPVault` tests and 29 multi-strategy tests.
- Slither / Mythril / Echidna clean of critical issues.
- Section 8 marks "External audit completed and published" and "All 527 tests passing" as checked.

What is actually in the tree:

- The only named reviewer is the header of `test/AuditRemediation.test.ts`: "Asfalia Security Audit". It lists 12 findings, all on `StakingBoost` (SB-01 through SB-07) and `ShieldToken` (ST-01 through ST-05). SB-01 is the high finding (owner could sweep FXRP rewards) and the test checks the fix. There is no PDF, no scope letter, no link, and no finding that mentions the vault, strategies, buffer, or withdrawals.
- `README.md` still says an external audit is recommended and not done. `docs/protocol/SHIELD_DEPLOYMENT.md` still has the audit box unchecked. `docs/partners/FIRELIGHT_PARTNER_GUIDE.md` says the vault is awaiting an external audit. The checklist and the rest of the docs disagree with each other.
- No Slither, Mythril, or Echidna report is in the repo. `package.json` has no coverage script and no `solidity-coverage` dependency.

Treat the 28 November 2025 note as an internal remediation checklist for the token and the boost contract. It is not a published audit of the vault.

### 1.4 Test run on 18 November 2026

Dependencies were installed from `package.json` (Hardhat 3, OpenZeppelin contracts 5.4, `@flarenetwork/flare-periphery-contracts` 0.1.38). Solidity compiled: 34 files with solc 0.8.22, 1 file (`ShieldV2Taxes`) with solc 0.8.10.

**Hardhat** (contract tests, explicit file list so the Vitest files were not loaded into Mocha):

```
263 passing
1 pending
12 failing
```

The pending test is `test/integration/FirelightIntegration.test.ts`, whose only case is `this.skip()`.

Failures:

| Suite | Result | Cause |
| --- | --- | --- |
| `test/ShXRPVault.MultiStrategy.test.ts` (23 cases, the buffer and partial-strategy tests) | Entire file aborted in `beforeEach` | Deploys `ShXRPVault` with 3 constructor args. The contract requires 5. Deploys `MockStrategy` with 2 args. The contract requires 3. **The liquidity tests do not run.** |
| `test/StakingBoost.test.ts` (38 cases) | Aborted in `beforeEach` | `StakingBoost` constructor reverts `Invalid vault address`. The test has not been updated to the 4-arg constructor. |
| `test/StakingBoost.Adversarial.test.ts` (33 cases) | Aborted in `beforeEach` | Wrong constructor arity. |
| `test/RevenueRouter.Security.test.ts` (19 cases) | Aborted in `beforeEach` | Wrong constructor arity. |
| `test/VaultController.test.ts` | 4 of 13 failed | Hardhat 3 removed the `.reverted` matcher (`HHE70024`). Bridge tests call `staticCall` to read a request id, then send the transaction. The id is `keccak256(user, vault, amount, block.timestamp)`, so the static-call id and the mined id differ. `getBridgeRequest` then returns an empty struct (`user == address(0)`) and `updateBridgeStatus` reverts `Request not found`. |
| `test/integration/FairLaunch.test.ts` | 4 failed, some token-math cases passed | Constructors are stale. One passing case still describes a 50/50 buyback. The router default is 50/40/10. |

`test/ShXRPVault.test.ts`, `ShieldToken`, `RevenueRouter`, `BuybackBurn`, `MerkleDistributor`, and `AuditRemediation` passed. Those passing vault tests use a mock strategy and an idle vault. They check that `pause()` makes `withdraw` revert and that `maxWithdraw` returns 0. They check share balances after a boosted redeem, not that the other depositor's assets are unchanged. The comment in the test says the bonus is paid by `donateOnBehalf`. The contract pays it from the vault balance in `_withdraw`.

**Solidity line coverage:** not produced. There is no coverage plugin. A percentage would be invented. From the files that ran, these paths have no live test:

- `deployToStrategy` refusing to cross a floor (the function does not implement a floor).
- User withdrawal when the strategy returns less than requested (`ShXRPVault.MultiStrategy.test.ts` expects `Insufficient liquidity in vault and strategies`, and that file did not run).
- Firelight `redeem` that does not transfer FXRP.
- Kinetic `mint` / `redeem` error codes.
- Inflation attack on a 6-decimal vault.
- A mainnet fork.

**Vitest** (`npx vitest run`, backend only; coverage provider `@vitest/coverage-v8` is not installed, so coverage was not collected):

```
Test files: 1 failed, 2 passed (3)
Tests: 27 passed
```

`test/backend/services.test.ts` failed to load: `server/db.ts` throws if `DATABASE_URL` is unset. The 27 passes are service unit tests under `server/services/__tests__/`, including the deposit watchdog. `test/integration/testnet-flows.test.ts` is a Vitest file that is outside both the Hardhat file list used here and the Vitest `include` list. It talks to the XRPL faucet unless `SKIP_NETWORK_TESTS=true`. It was not run. It is not an end-to-end redeem-to-XRP test against current mainnet FAssets.

---

## 2. Staleness against Flare, Firelight, and Kinetic

Sources read on 18 November 2026:

- [FAssets reference](https://dev.flare.network/fassets/reference)
- [FXRP address guide](https://dev.flare.network/fxrp/token-interactions/fxrp-address)
- [Firelight withdraw](https://dev.flare.network/fxrp/firelight/withdraw) and [claim](https://dev.flare.network/fxrp/firelight/claim)
- [Firelight unstaking](https://docs.firelight.finance/for-stakers/unstaking-and-withdrawals)
- [Upshift vaults](https://dev.flare.network/fxrp/upshift)
- [Kinetic contract list](https://docs.kinetic.market/contracts-and-api-documentation/)
- On-chain `eth_call` against `https://flare-api.flare.network/ext/C/rpc`

### 2.1 FXRP and FAssets

| Item | This repo | Live, 18 Nov 2026 |
| --- | --- | --- |
| Canonical FXRP | `shared/flare-contracts.ts` lists `0xAd552A648C74D49E10027AB8a618A3ad4901c5bE` as "alt" and `0xAf7278D382323A865734f93B687b300005B8b60E` as primary. `IStrategy.sol` and `scripts/deploy-mainnet-strategies.ts` use `0xAd552…`. | **`0xAd552A648C74D49E10027AB8a618A3ad4901c5bE`**. Symbol `FXRP`, **6 decimals**. This is what Firelight `asset()` and Kinetic isoFXRP `underlying()` return. |
| The other address | Documented as the primary FXRP token. | `0xAf7278…` is a contract named **fXRP with 18 decimals**. It is a different token. `ShXRPVault.decimals()` copies the asset. Pointing the vault at it would make shares 18 decimals while `minDeposit` (10,000) and `depositLimit` (`1_000_000e6`) assume 6. |
| AssetManager, Flare mainnet | "Do not hardcode; read the registry." No current address checked in. | Registry name `AssetManagerFXRP`. Published address **`0x2a3Fe068cD92178554cabcf7c95ADf49B4B0B6A8`**. Controller **`0x097B93eEBe9b76f2611e1E7D9665a9d7Ff5280B3`**. |
| Coston2 FTestXRP | `coston2-latest.json` uses `0x0b6A3645c240605887a5532109323A3E12273dc7`. `shared/flare-contracts.ts` still also lists deprecated `0xa3Bd00D652D0f28D2417339322A51d4Fbe2B22D3`. | Official FTestXRP is **`0x0b6A3645c240605887a5532109323A3E12273dc7`**. Testnet AssetManager is **`0xc1Ca88b937d0b528842F95d5731ffB586f4fbDFA`**. |
| Redeem interface | App code and docs describe a bridge the operator finishes. Installed periphery `0.1.38` `IAssetManager.redeem(uint256 lots, string redeemer, address executor)` returns a partial amount and emits `RedemptionRequestIncomplete` when tickets run out. | Current docs also document **`redeemWithTag`** (destination tag for exchanges). That function is **not declared** in the installed `IAssetManager.sol`. Refresh the periphery package before writing the redeem path. FAssets redemption is asynchronous: the agent pays XRP on XRPL, or the redeemer is paid in collateral after a timeout. A vault "redeem" that only burns shXRP for FXRP has not finished the user's XRP withdrawal. |
| `FAssetBalanceTooLow` | Not handled. | Live `FAsset` transfer hook. Any claim that asks for more FXRP than the sender holds reverts the entire transaction. |

`ShXRPVault` never calls the AssetManager. Mint and redeem of XRP sit in the TypeScript services (`server/utils/fassets-client.ts`, `server/routes.ts`). Those services are not covered by a passing mainnet-fork test.

### 2.2 Firelight

The address in the repo is still the live vault:

| | |
| --- | --- |
| stXRP vault | `0x4C18Ff3C89632c3Dd62E796c0aFA5c07c4c1B2b3` (transparent proxy, implementation `FirelightVault`) |
| `asset()` | `0xAd552A648C74D49E10027AB8a618A3ad4901c5bE` |
| `totalAssets()` | 39,873,076.98 FXRP |
| `totalSupply()` | 39,726,632.66 stXRP |
| Exchange rate | about 1.0037 FXRP per stXRP |
| `currentPeriod()` | 309 |
| `SMALLEST_PERIOD_DURATION()` | 86,400 seconds |
| `pendingWithdrawAssets()` | **11,520,603.90 FXRP** already waiting on a delayed exit |

`FirelightStrategy` was written for an instant ERC-4626:

```139:169:contracts/FirelightStrategy.sol
function withdraw(uint256 amount, address receiver) external override onlyRole(OPERATOR_ROLE) returns (uint256 actualAmount) {
    // ...
    actualAmount = stXRPVault.redeem(sharesToRedeem, receiver, address(this));
    // ...
}
```

Current Firelight does not do that. The Flare developer hub and the Firelight vault interface say `withdraw` and `redeem` burn shares and create a request for the current period. FXRP moves only when someone later calls `claimWithdraw(period)`, and only after that period has ended. The product docs describe a 30-to-60 day unstaking window while staked FXRP backs coverage, plus a blocklist that can stop withdraw and transfer. `periodConfiguration(uint256)` reverted for the guessed signature, so this review does not claim the live period length from chain. The interface and the 11.52M FXRP already sitting in `pendingWithdrawAssets` are enough: exit is delayed, and the adapter has no `claimWithdraw`.

Consequences if this adapter is activated as written:

- A user `withdraw` that needs Firelight liquidity calls `redeem`, receives no FXRP, fails the vault's balance check, and reverts. The user sees the same closed failure as Monarq.
- `totalAssets()` on the strategy is `convertToAssets(stXRP balance)` only. It ignores FXRP sitting on the strategy and ignores a pending Firelight claim. After a request, reported assets fall even though the claim is still the strategy's property.
- `emergencyWithdraw` calls `redeem` for the full balance and then deactivates. It does not claim. Admin "emergency" creates a pending request the strategy cannot complete.
- The deployer keeps `OPERATOR_ROLE`. A direct `strategy.withdraw` from that key burns stXRP into a claim the vault does not track.
- Firelight can blocklist the strategy address. The vault's `totalAssets` try/catch then substitutes `totalDeployed`, which keeps the share price up while the assets are stuck.

The in-repo Firelight guide (`docs/integration/FIRELIGHT_INTEGRATION.md`) still says instant withdrawal is the expected path and that a queue would clear in under 24 hours. That guide is out of date.

### 2.3 Kinetic

`KineticStrategy` never calls Kinetic. Comments name a cToken and a comptroller and leave both unset. `deploy` holds FXRP on the strategy. `totalAssets` returns `totalDeployedAmount + accumulatedYield`. `simulateYield` lets the operator increase that number.

Live ISO market (the FXRP market that matters), from Kinetic's docs and confirmed `underlying()`:

| Contract | Address |
| --- | --- |
| isoFXRP cToken (`Lending FXRP`) | `0xD1b7A5eFa9bd88F291F7A4563a8f6185c0249CB3` |
| Underlying | `0xAd552A648C74D49E10027AB8a618A3ad4901c5bE` |
| ISO Unitroller | `0x15F69897E6aEBE0463401345543C26d1Fd994abB` |
| ISO comptroller implementation | `0x35aFf580e53d9834a3a0e21a50f97b942Aba8866` |
| Interest-rate model | `0xE625338E3778B63B11D1aE7aB26E435fCb8f1664` |

This is Compound V2. `mint(uint256)` and `redeem(uint256)` return an error code. They do not always revert. `exchangeRateCurrent()` is not a view. A correct `totalAssets` has to use `exchangeRateStored` after `accrueInterest`, and `mint` has to check the return code. Redeem pays only if the market's cash covers it. Kinetic's own site showed, on this date, on the order of 34.5M FXRP supplied and about 2.1M borrowed in the ISO market, so cash is deep today. That is not an invariant. A strategy that ignores the error code will report success and leave the vault short.

The primary-market comptroller (`0xeC7e541375D70c37262f619162502dB9131d6db5`) is a different market. The adapter must target the ISO unitroller and the isoFXRP cToken, or it will lend into the wrong pool.

### 2.4 Sentora and Upshift, as they exist today

These are not implemented anywhere in `contracts/`. They are the external yield the vault might later plug in. They are not interchangeable.

| Venue | What it is on 18 Nov 2026 | Redemption terms that are public | Fit for a majority of shXRP TVL |
| --- | --- | --- | --- |
| Upshift Monarq XRP Yield Vault `0x2439D4bb753A0f3777d4C9011AFacc475ba6B951` | Curator Monarq. Receipt MXRPY. App TVL 5.06M FXRP. On-chain idle FXRP 48,553.66. | Weekly, Fridays, plus a paid instant lane. [Upshift's own launch post](https://www.upshift.finance/blog/monarq-xrp-yield-vault-mxrpy-flare). On this date the instant and matured paths could not pay. | No. This is the failure mode. |
| Upshift Flare XRP Yield Vault (earnXRP) `0x373D7d201C8134D4a2f7b5c63560da217e3dEA28` | Curator Clearstar, not Sentora. Receipt earnXRP. App TVL about $30.7M. Allocates across lending, LP, and carry, including Kinetic and Firelight. | Upshift's generic flow is `instantRedeem` (fee) or `requestRedeem` then `claim(year, month, day)`. | No. Same curator-vault shape, delayed by design. |
| Sentora | Incubated Firelight. The FXRP product in current Flare news is **FXRP as collateral to borrow RLUSD** in a MetaMorpho vault on Ethereum, after a Stargate bridge. | Borrower position, not a Flare staking receipt. | No Flare adapter to write until Sentora publishes a Flare vault with on-chain terms. |
| Firelight stXRP | See §2.2. | `claimWithdraw` after the period. Docs: 30–60 days. | Only with a queue at least that long, and a cap. |

---

## 3. Security review

Findings are from reading the contracts and from the test run. They are not the output of a fuzzer or a second reviewer. Severity is impact on depositors if the contract is deployed as it is, with the owner and operator keys the scripts create (the deployer EOA).

### Critical

**C-1. The buffer is not a constraint.** `bufferTargetBps` defaults to 1,000. `deployToStrategy` checks only `balanceOf(vault) >= amount`. It does not read the target. `setBufferTarget(0)` is legal. `VaultController.deployToStrategies` does refuse to deploy when the buffer is at or below its own 10% constant, but that function is optional. The vault operator, or the deployer key that also holds `OPERATOR_ROLE` on the strategy, can call `ShXRPVault.deployToStrategy` and move 100% of idle FXRP. After that, a user withdraw takes the Monarq path: pull from strategies, then `require(balance >= grossAssets)` and revert `Insufficient liquidity in vault and strategies` (`ShXRPVault.sol` around the `_withdraw` shortfall check). No partial fill, no request id, no maturity.

**C-2. Firelight cannot fund that pull.** §2.2. Wiring `FirelightStrategy` at the scripted 50% target makes the revert the normal exit whenever the buffer is short. The adapter also destroys the position (burn via `redeem`) without a `claimWithdraw` to get it back, if anyone calls `withdraw` or `emergencyWithdraw` on the strategy itself.

**C-3. `pause()` freezes depositors and does not freeze the operator.** `deposit`, `mint`, `withdraw`, and `redeem` are `whenNotPaused`. `maxWithdraw` and `maxRedeem` return 0 while paused, which the tests treat as ERC-4626 compliance. `deployToStrategy`, `withdrawFromStrategy`, `claimAccruedFees`, and `reportStrategy` are not paused. The owner can stop every user exit and the operator can still deploy the remaining idle FXRP or send the whole buffer to `RevenueRouter` as fees. Unpause is the same owner, with no timelock. The UI copies this: `VaultCard` says a paused vault has deposits and withdrawals disabled.

### High

**H-1. The withdraw boost pays from other depositors' FXRP.** `_withdraw` calls `stakingBoost.getBoost(owner)` and then `safeTransfer`s `assets * boost / 10000` extra FXRP to the receiver. Shares burned do not include that bonus. `previewRedeem` omits it on purpose. The solvent path already exists: `StakingBoost.claim` pushes FXRP into the vault and `donateOnBehalf` mints shares. The cash bonus is a second mechanism, and it is unfunded. Default cap is 25%. The owner can set it to 100%. If `stakingBoost` is still `address(0)`, the external call reverts and **every withdrawal reverts**, including users with no boost.

**H-2. `KineticStrategy.simulateYield` and internal `totalAssets` can mark the vault insolvent.** The vault adds `strategy.totalAssets()` into its own `totalAssets()`. A phantom increase raises the share price. Redeemers are paid from real FXRP. The same trust applies to any strategy the owner adds: `addStrategy` checks `asset()` and nothing else. There is no cap. `targetBps` is not enforced on deploy.

**H-3. If `strategy.totalAssets()` reverts, the vault books `totalDeployed`.** That fallback is in `ShXRPVault.totalAssets`. `totalDeployed` is updated to the strategy's reported `assetsAfter` inside `reportStrategy`, and it is not reduced when the position is stuck or blocklisted. Share price stays high, new depositors pay it, and withdrawals fail when the cash is not there.

**H-4. Protocol fees are taken from the idle buffer, and they are not reserved ahead of withdrawals.** `reportStrategy` does `accruedProtocolFees += profit * yieldRoutingFeeBps / 10000` even though the profit stayed in the strategy. `claimAccruedFees` then transfers `min(accrued, balanceOf(vault))` to the router. Those tokens were counted in `totalAssets` until the claim, so the share price drops on claim, and the idle balance can fall below what withdrawals need. Yield fee max is 5% of reported profit, set by the owner, with no timelock.

**H-5. Six-decimal ERC-4626 with a zero decimals offset.** Installed OpenZeppelin 5.4 `ERC4626._decimalsOffset()` returns 0. Conversions use `totalSupply + 10**offset` and `totalAssets + 1`. `ShXRPVault` does not override the offset and does not seed dead shares. FXRP has 6 decimals. A donation to an empty or nearly empty vault can round the next depositor's shares down sharply. `depositLimit` does not stop it. This needs an offset override (a value that adds virtual shares, typically on the order of the missing 12 decimals of precision, or at least a few virtual shares per wei) and a fuzz test. It is launch-day risk, before any strategy is wired.

**H-6. One EOA is the whole control plane.** Coston2 owner and operator is the deployer. `scripts/deploy-mainnet-strategies.ts` deploys strategies with the deployer as admin and operator, prints "transfer to multisig" as a log line, waits 5 seconds, and deploys. There is no Safe, no timelock, and no on-chain delay on `addStrategy`, `pause`, `setBufferTarget`, `setDepositLimit`, or `setGlobalBoostCap`. A leaked deployer key can add a strategy that reports arbitrary `totalAssets`, deploy the buffer into it, and pause user exits.

### Medium

**M-1. Strategy calls are not on the vault's reentrancy lock where it matters.** `deposit` / `withdraw` / `deployToStrategy` / `withdrawFromStrategy` use `nonReentrant`. `reportStrategy` and `claimAccruedFees` do not. A strategy invoked during `report` can call back into the unlocked functions. FXRP itself has no receiver hook, so this is not an ERC-777 callback. It is a malicious-strategy or compromised-strategy issue, which matters because the owner can point at any contract.

**M-2. `RevenueRouter.withdrawReserves` transfers any FXRP amount**, including fees that `distribute()` has not split yet. `distribute()` is public and swaps through a single 0.3% pool using an owner-set `lastKnownPrice`. Slippage can be set to 20%. There is no `ReentrancyGuard`. The router address is immutable, so the DEX trust is fixed at deploy. There is no evidence in this repo of a SHIELD/FXRP V3 pool at 0.3% on mainnet, and no fork test.

**M-3. `RevenueRouter` and `BuybackBurn` are two burn paths** (FXRP fees versus donated wFLR) with separate price variables. The fair-launch test still talks about a 50/50 split. Easy to operate the wrong one.

**M-4. Vault and controller disagree.** The controller's buffer, Kinetic, and Firelight weights are constants and it finds strategies by the strings `"Kinetic"` and `"Firelight"`. The vault's targets are separate storage. Rebalance is a no-op against a vault that was configured under different names. `createBridgeRequest` does not check that the vault is registered, and the request id depends on `block.timestamp`, so two identical requests in one block collide and an off-chain watcher cannot recompute the id unless it saw the event.

**M-5. `donateOnBehalf` ignores the deposit limit and the pause.** That is acceptable for a later reward minter. It is another way shares appear without going through `deposit`.

**M-6. Custom LayerZero OFT and the tax token.** `ShieldOFT.emergencyWithdraw` and `ShieldV2Taxes.removeTokens` are owner drains. They are out of the vault's asset path only if they are never deployed and never pointed at by the frontend.

**M-7. Backend deposit accounting is still not the vault.** `POST /api/deposits/fxrp` stores shXRP shares equal to the FXRP amount ("1:1 mapping for now") and writes a completed transaction whose hash is `fxrp-deposit-${Date.now()}-…`. `POST /api/withdrawals/fxrp` was changed after this review so it no longer deducts shares or marks the withdrawal completed before a confirmed transaction. It now stores status `pending` and returns HTTP 202. The XRP redemption path and the deposit path still need the same standard. The modal copy that said a direct withdrawal usually finishes within 30 seconds is not on-chain settlement.

### Low

**L-1.** `setTestnetLockBypass` cannot be enabled when `chainid != 114`. The function should not be in the mainnet bytecode, so a future chainid change cannot revive it. Easy to omit from the v1 source.

**L-2.** Reward-index rounding in `distributeBoost` (`fxrpAmount * 1e18 / totalStaked`) can leave dust that `getRecoverableFxrp` will not release, because `totalUnclaimedRewards` counts the full amount. Dust locks. It does not steal.

**L-3.** `previewWithdraw` grosses the fee up, then `_withdraw` recomputes the fee as `super.previewRedeem(shares) - assets`. If rounding ever makes that difference underflow, the withdrawal reverts. The passing tests use round numbers. This wants a fuzz test before mainnet, not a guessed exploit.

**L-4.** `ShieldToken` mints 10M to the deployer (ST-01, acknowledged). Distribution is off-chain. Fine for a later token. Irrelevant to a v1 that does not list SHIELD.

### What is in decent shape

- `ShieldToken` matches its comments: fixed supply, no admin.
- `StakingBoost.recoverTokens` refuses to take FXRP above `balance - (totalUnclaimedRewards + pendingOrphanedRewards)`, and the Asfalia tests that still run cover that.
- `MerkleDistributor` has an immutable root and a claim bitmask. Owner withdraw of unclaimed tokens is a real power and should sit behind the same multisig.
- Deposit and withdraw fees on the happy path are deducted in `previewDeposit` / `previewRedeem`, and the passing tests check the router received them.
- OpenZeppelin `ReentrancyGuard` and `SafeERC20.forceApprove` are used on the main value paths that have the modifier.
- `decimals()` follows the asset, which is correct once the asset is the 6-decimal FXRP and wrong if it is the 18-decimal fXRP.

### Oracles

The vault does not read an oracle. Share price is `totalAssets / totalSupply`, and `totalAssets` trusts each strategy. Firelight's rate is the Firelight vault's own conversion, which already includes its coverage accounting. Kinetic, once implemented, must use the cToken exchange rate, not a spot price. `RevenueRouter.lastKnownPrice` is an admin input used as a slippage floor. It is not a depositor price oracle. Do not add a spot oracle to the share price.

---

## 4. Liquidity design

This is the gap that makes the Monarq incident possible here.

### 4.1 What the code does

| Question | Answer in the current contracts |
| --- | --- |
| Is there an on-chain floor equal to `max(percent of TVL, next 7 days of queued withdrawals)` that a strategy cannot cross? | No queue exists, so the 7-day term is zero. The percent is a target. `deployToStrategy` can cross it. `claimAccruedFees` can spend the idle balance down to zero. |
| Is there an instant lane and a queued lane with a settlement window? | One lane. `withdraw` / `redeem` pay immediately or revert. No `readyAt`. |
| Do claims pay what they can instead of reverting? | No. `_withdrawFromStrategies` skips a strategy that reverts, then the outer `require` reverts the whole call if the vault is still short. The user receives nothing. |
| Can anyone read idle versus deployed versus queued on-chain? | Idle: `getBufferBalance`. Deployed: `getTotalDeployed` and `getCurrentAllocations`. Queued: nothing to read. `getBufferStatus` compares idle with the target and cannot tell a user when they will be paid. |

`getBufferTarget` is `totalAssets * bufferTargetBps / 10000`. It includes assets that are not in the vault. A 10% target on 5.06M TVL is about 506k FXRP. Monarq's idle of 48.6k would have shown a large `deficit` from this view, and nothing in Shield's contracts would have stopped the deploy that created it.

### 4.2 The invariant to put in `ShXRPVault`

Write it in the vault, not in `VaultController`. The controller can be bypassed. The vault cannot.

```text
freeIdle     = balanceOf(asset, vault) - reservedFees - reservedForMaturedClaims
floor        = max(totalAssets * bufferFloorBps / 10_000,
                   assetsQueuedWithReadyAt <= block.timestamp + 7 days)
deployable   = freeIdle > floor ? freeIdle - floor : 0
```

`deployToStrategy(strategy, amount)` reverts unless `amount <= deployable` after accounting for fees and for every request that matures inside the window. The same check applies to `claimAccruedFees`: fees may be taken only from `deployable`, never from the floor and never from matured claims. Set a non-zero floor in the constructor. Cap `setBufferFloor` so the owner can raise it and can lower it only through the timelock, and cannot set it to zero in the same transaction as a deploy.

`bufferFloorBps` of 1,000 (10%) is a reasonable v1 number. It is not sufficient by itself. On a 5M FXRP vault, 10% is 500k, which would have covered Monarq's 56.9k matured claims. It would not cover a week of exits if depositors queue more than the floor. The `max` with the 7-day queue is what keeps the next week payable. Strategies that cannot return funds inside 7 days do not count toward the floor. Their assets are illiquid backing, disclosed as such, and capped.

### 4.3 Two lanes

**Instant.** `withdraw` / `redeem` pay in the same transaction only up to `freeIdle`. They may use the floor. They may not call a strategy that is not instant. If the user asks for more than `freeIdle`, the call does not pull from Firelight and revert. It offers the queued lane (a separate function, so wallets that expect ERC-4626 `withdraw` to be atomic are not silently locked).

**Queued.** `requestRedeem(shares, receiver)` escrows or burns the shares at the current rate, stores `assetsOwed`, and sets `readyAt = block.timestamp + settlementWindow`. v1 window: **7 days**, stored on-chain, raised only by the timelock. A strategy whose published delay is longer than the window cannot be used to satisfy that request. The keeper's job is to call `withdraw` on liquid strategies early enough that `freeIdle` covers requests as they mature. The user does not depend on the keeper to get *something*: the claim function itself pays.

**Claim.**

```text
pay = min(assetsOwed - assetsClaimed, freeIdleIncludingFloor)
if pay == 0: return 0          // do not revert
assetsClaimed += pay
transfer pay to receiver
if assetsClaimed == assetsOwed: close the request
```

A short vault pays what it holds and leaves a remainder with the same `readyAt` in the past, so the remainder stays at the head of the queue. The event carries `paid`, `remaining`, and `idleAfter`. That is the opposite of `FAssetBalanceTooLow`.

ERC-4626 `maxWithdraw` should return the instant amount, not the queued amount. Document the deviation. Integrators that call `withdraw` for the full `maxRedeem` must get the instant number, not a revert.

### 4.4 On-chain views the dashboard should read and not recompute

- `idleAssets()`, `reservedFees()`, `deployedAssets()`, `queuedAssets()`
- `maturingWithin(uint256 horizon)`
- `bufferFloor()` and `deployable()`
- `withdrawal(id) -> owner, receiver, assetsOwed, assetsClaimed, readyAt, closed`
- per strategy: `capBps`, `assets`, `maxInstantWithdraw()`, `redemptionDelay()`, `termsHash`

Matured unpaid claims are first in line, ahead of the percentage floor and ahead of fees.

### 4.5 Pause

`pause()` may block `deposit`, `mint`, and `deployToStrategy`. It must not block `requestRedeem`, `withdraw` of idle FXRP, or `claim`. A strategy-level pause may stop new deployment into that strategy. It must not stop a claim on FXRP that is already in the vault. If a bug is bad enough that idle FXRP itself cannot be paid out, that is a published incident with a timelocked migration to a new vault, not a silent freeze. The current "pause returns maxWithdraw = 0" behavior should be removed. It is the feature that trapped users would hit first.

### 4.6 Concrete edits, if the current files are the starting point

These are the changes to make in the rewrite. They are not applied in this branch.

1. `ShXRPVault.deployToStrategy`: require the post-deploy idle to be at least the floor defined above. Remove the public operator's ability to pass an amount that ignores it.
2. Add the request, claim, and view functions in §4.3 and §4.4. Keep `withdraw` / `redeem` as the instant lane only.
3. `claimAccruedFees`: cap the transfer at `deployable`. Subtract `accruedProtocolFees` from `totalAssets` so the fee is a liability the whole time it is accrued.
4. Delete the `getBoost` transfer in `_withdraw`. If `stakingBoost` is unset, skip it. Do not revert.
5. `totalAssets`: if a strategy call fails, do not add `totalDeployed`. Stop deposits (`maxDeposit = 0`) and leave claims open. Count only assets the adapter can justify: idle FXRP on the adapter, pending claims the adapter recorded, and `min(reported, cap)`.
6. Override `_decimalsOffset` and add a fuzz test that donates before the first real deposit.
7. `FirelightStrategy`: replace `redeem` with `request` + `claimWithdraw`. `totalAssets` includes pending claims. `maxInstantWithdraw` returns 0 until Firelight actually pays instantly. Until that adapter exists, the vault cap for this strategy is 0.
8. `KineticStrategy`: delete `simulateYield`. Implement `mint` / `redeemUnderlying` with error-code checks and `getCash`. `maxInstantWithdraw` returns `min(ourUnderlying, marketCash)`.
9. Strategy `OPERATOR_ROLE` for `deploy` and `withdraw` should be the vault only. The deployer EOA should not keep it.

---

## 5. External yield as a capped adapter

Sentora and Upshift are curator vaults. Monarq showed what happens when the curator vault is the position: about 99% of FXRP left the contract that users claim against, and the claim contract had no partial path.

If a curator vault is added later, it is one adapter among others, behind the floor in §4.

**Hard cap, checked in `deployToStrategy`.** Suggested v1 ceiling if one is added at all: **10% of `totalAssets` (1,000 bps)**, per curator, stored on the strategy and enforced by the vault. A target of 50% is not a cap. Lowering the cap does not pull funds back. Raising it goes through the timelock. The sum of strategy caps may exceed 100%. The floor still binds, so the curator can never be filled by draining the 7-day queue.

**The adapter publishes terms on-chain**, set once at configuration and changed only by the timelock:

- curator name and vault address
- `redemptionDelay` (seconds)
- `instantFeeBps`
- `maxInstantWithdraw()`
- `termsHash` of the human-readable policy (weekly Friday, instant fee, or Firelight period)

The vault counts `maxInstantWithdraw()` toward the 7-day floor. Assets only available after `redemptionDelay` are excluded from that floor. If `redemptionDelay` is longer than the settlement window, the adapter can still hold its capped slice, and the UI labels it illiquid. It cannot be the source of the 7-day promise.

**Request and claim live on the adapter**, matching Upshift (`requestRedeem` / `claim`) or Firelight (`redeem` / `claimWithdraw`). The vault stores the external request id. `totalAssets` includes the pending claim at the conservative rate. A failed external claim returns 0 to the vault's claim function, which then pays the user whatever idle FXRP it does have.

**Do not use Monarq, earnXRP, or a future Sentora vault as the primary strategy.** earnXRP's published behavior is to redeploy into Kinetic, Firelight, LP, and carry. Putting shXRP into earnXRP would stack two vaults that both think the other one holds the buffer. Sentora's current FXRP product is Ethereum collateral, not a Flare receipt. There is nothing to integrate until an address and a redemption function exist on Flare.

A practical v1 is no curator adapter. Add the interface so the cap and the terms are hard to "temporarily" skip later.

---

## 6. Mainnet checklist

Order is the order to do the work. Sizes are the relative sizes from the top of this document.

| # | Work | Size | Done when |
| --- | --- | --- | --- |
| 1 | Rewrite vault liquidity: floor, instant lane, 7-day queue, partial `claim`, views, fees reserved, pause cannot freeze claims. Fuzz the 6-decimal offset. | L | A test deploys 99% toward strategies and the transaction reverts. A second test matures a claim larger than idle and pays `idle`, leaves a remainder, and does not revert. A third test calls `pause` and still claims idle FXRP. |
| 2 | Delete the cash boost in `_withdraw`. Withdrawals succeed with `stakingBoost == address(0)`. | S | A redeem with no boost contract returns the preview amount and leaves other depositors' `convertToAssets` unchanged. |
| 3 | Per-strategy caps inside the vault. `deploy` / `withdraw` callable only by the vault. Remove `simulateYield`. | M | A deploy above the cap reverts. An EOA with the old operator role cannot call `strategy.withdraw`. |
| 4 | Kinetic adapter against the live ISO cToken `0xD1b7…9CB3` and unitroller `0x15F6…4abB`, on a Flare mainnet fork. Cap at or below the residual after the floor (v1 suggestion: 40% only after the fork test shows `redeem` error codes and low-cash behavior). | M | Fork test supplies FXRP, accrues, redeems, and a low-cash fixture returns a partial `maxInstantWithdraw` instead of a false success. |
| 5 | Firelight adapter is not activated. Cap stays 0 until `claimWithdraw` is implemented and the settlement window is at least Firelight's real delay. | L, later | `maxInstantWithdraw()` is 0 in the fork test against `0x4C18…B2b3`. |
| 6 | Multisig and timelock. Safe owns the vault. A timelock (48 hours is a normal parameter delay) sits in front of cap increases, floor decreases, new strategies, fee changes, and the router price. The deployer EOA is not an operator. Pause of deposits can be a faster guardian role. Pause of claims does not exist. | M | A scripted rehearsal on Coston2 shows an EOA `addStrategy` reverting and a queued admin call waiting out the delay. |
| 7 | Deposit cap. The storage variable already exists (`depositLimit`, default 1,000,000e6). v1 should start much lower (low tens of thousands of FXRP) and only move through the timelock. | S | `maxDeposit` matches the cap. The backend stops pretending liquidity is a database column. |
| 8 | New external audit of the vault, the Kinetic adapter, and the queue. Bug bounty after the report is public. The Asfalia note does not cover this code. Publish the PDF in the repo. Re-run the tests on the audited commit and archive coverage. | L | The report's scope lists `ShXRPVault` and the adapter. High findings are closed or explicitly accepted in the report. |
| 9 | Flare mainnet scripts. Read AssetManager and FXRP from the contract registry. Hard-pin the canonical 6-decimal FXRP and fail the script if `decimals() != 6` or `symbol` is the 18-decimal fXRP. Remove the 5-second auto-continue. Do not grant the deployer `OPERATOR_ROLE`. Write `deployments/flare-mainnet.json` only after verify. | M | A dry run against a fork logs the registry addresses and refuses `0xAf7278…`. |
| 10 | Keeper and monitoring. A keeper calls strategy withdraw so `freeIdle` covers `maturingWithin(7 days)`, and calls `claim` for users who have not. Alert when `deployable == 0`, when a claim pays a partial, when `strategy.totalAssets` disagrees with the vault's checkpoint, and when Firelight or Kinetic admin changes. The public dashboard reads the views in §4.4. It does not use the database as the source of TVL. | M | A staged shortfall shows idle, deployed, queued, and the next `readyAt` on a page a user can open. |
| 11 | End-to-end redeem to XRP on current FAssets. Mint a small FXRP, deposit, instant-withdraw to FXRP, `AssetManager.redeem` (and `redeemWithTag` if the destination needs a tag) to an XRPL address, and confirm the XRP payment or the collateral-default path. Refresh `@flarenetwork/flare-periphery-contracts` past 0.1.38 so `redeemWithTag` is in the interface. One lot-sized run is enough. Record the txids. | M | The txid of the XRPL payment is in the deployment notes. |
| 12 | Frontend. Remove the 1:1 share write and the completed-before-broadcast withdrawal in `server/routes.ts`. Show instant available, queued amount, `readyAt`, and partial-claim progress. A paused vault still shows Claim. Point at canonical FXRP only. | M | A deposit of FXRP shows shares from `previewDeposit`, not from the request body. A partial claim does not render as a failure. |

Out of this checklist until after v1 has been live and the queue has paid real claims: SHIELD distribution, `StakingBoost`, `RevenueRouter`, `BuybackBurn`, merkle airdrop, presale, LayerZero OFT, `ShieldV2Taxes`.

---

## 7. v1 scope and later phases

### v1, the minimal safe launch

Ship one vault and one exit path that cannot trap FXRP.

- New `ShXRPVault`, not an upgrade of the Coston2 vault. Asset is canonical 6-decimal FXRP. Decimals offset set. Deposit cap small and timelocked.
- On-chain floor, instant redeem up to idle, 7-day queue, partial claims, public views.
- Pause stops deposits and new deployment. Claims of idle FXRP stay open.
- No `getBoost` cash bonus. `stakingBoost` left unset.
- No Firelight, no Upshift, no Sentora. Caps for those strategies exist and are zero.
- Kinetic only after checklist item 4 passes on a fork. If the fork test slips, v1 holds 100% of FXRP in the vault. Yield can wait. An exit that works is the product.
- Safe + timelock. Deployer key renounced from every role.
- Fresh audit of that vault. Bounty opened when the audit is public.
- One completed XRP → FXRP → shXRP → FXRP → XRP on mainnet before the cap is raised.
- Frontend reads the vault. The database is a cache.

That launch does not need a SHIELD token, a points program, or a second chain.

### Phase 2, liquid yield

- Kinetic adapter at a capped share, `maxInstantWithdraw` tied to market cash, keeper topping up the 7-day floor.
- Monitoring and the public liquidity page, if they were thin in v1.
- Raise the deposit cap through the timelock only after a week of claims paid in full.

### Phase 3, delayed yield

- Firelight adapter with `claimWithdraw`, a cap, and a settlement window no shorter than Firelight's period. Until the window matches, the cap stays 0.
- A single curator adapter (Upshift or, if it exists by then, a Sentora Flare vault) at or under 10%, with `termsHash` and `redemptionDelay` on-chain. Monarq's weekly terms would be a Phase 3 adapter, never the vault itself.

### Phase 4, the token

- `ShieldToken` distribution under the multisig, with the 10M mint going to vesting contracts rather than an EOA. ST-01 stays an acknowledgement only if the addresses are public.
- `StakingBoost` only through `donateOnBehalf`, funded by fees that have already been reserved. No second payment inside `withdraw`. The 30-day lock and the Coston2 bypass function stay off mainnet.
- `RevenueRouter` only after a SHIELD/FXRP pool exists and a fork test shows the slippage floor. Owner `withdrawReserves` limited to the residual after a distribution, not the whole balance.
- Merkle airdrop, presale, and OFT are separate launches with their own review. `ShieldV2Taxes` is not part of any phase.

---

## Sources

- This repo at `main` commit `0825423` (2025-12-29), including `deployments/coston2-latest.json`.
- Hardhat run recorded in §1.4. Vitest run recorded in §1.4.
- Flare Developer Hub, FAssets reference and Firelight withdraw/claim guides, fetched 18 November 2026.
- Firelight docs, unstaking and withdrawals, fetched 18 November 2026.
- Kinetic docs, contract addresses, fetched 18 November 2026.
- Upshift Monarq launch post and the Upshift app page for `0x2439D4bb753A0f3777d4C9011AFacc475ba6B951`, fetched 18 November 2026.
- On-chain reads the same day: FXRP `balanceOf` of the Monarq vault; Firelight `asset`, `totalAssets`, `totalSupply`, `currentPeriod`, `SMALLEST_PERIOD_DURATION`, `pendingWithdrawAssets`; Kinetic isoFXRP `underlying`; code at the 18-decimal fXRP address.
