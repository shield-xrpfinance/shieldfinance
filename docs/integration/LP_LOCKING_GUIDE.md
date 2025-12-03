# LP Token Locking Guide for Shield Finance Fair Launch

> **Status:** Launch details are TBC (To Be Confirmed). This guide covers planned LP locking procedures.

## Overview

This guide provides comprehensive information on locking LP tokens for the Shield Finance ($SHIELD) fair launch on Flare mainnet. Locking liquidity is **critical** for:

- Building community trust
- Preventing rug pulls
- Meeting fair launch standards
- Satisfying exchange listing requirements
- Demonstrating long-term commitment to the project

## LP Token Details

After running the SparkDEX LP deployment script, you will receive:

- **LP NFT Token ID**: Unique identifier for your Uniswap V3 position
- **Position Manager Contract**: `0xEE5FF5Bc5F852764b5584d92A4d592A53DC527da`
- **Initial Liquidity**: 535,451 wFLR + 1,000,000 SHIELD (~$10K USD) (TBC)
- **Lock Duration Target**: 12 months (365 days) (TBC)

## LP Locking Options on Flare Mainnet

### Option 1: Team Finance (Recommended)

**Status**: Recently integrated with Flare Network (2025)

**Pros**:
- Trusted industry standard
- Used by SparkDEX for SPRK token launch
- Professional UI/UX
- Transparent on-chain verification
- Community recognition

**Cons**:
- Specific Flare mainnet contract addresses not yet widely documented
- May charge service fees

**How to Use**:
1. Visit https://www.team.finance/
2. Connect wallet and switch to Flare mainnet
3. Navigate to "Lock Tokens" section
4. Select "Lock NFT" or "Lock LP Position"
5. Enter NFT token ID from deployment output
6. Set lock duration to 365 days
7. Confirm transaction
8. Verify lock on Flare block explorer

**Research Required**:
- Confirm Flare mainnet support status
- Check service fees
- Verify smart contract addresses on Flare
- Contact Team Finance support if needed

**Official Links**:
- Website: https://www.team.finance/
- Documentation: Check their docs for Flare-specific guides
- Support: Use their Discord/Telegram for Flare integration questions

---

### Option 2: Unicrypt Network

**Status**: Popular alternative, check Flare support

**Pros**:
- Widely used in DeFi
- Multi-chain support
- Transparent locking mechanism
- Liquidity locker statistics

**Cons**:
- Flare mainnet support unconfirmed
- Service fees may apply

**How to Use**:
1. Visit https://www.uncx.network/
2. Check if Flare mainnet is supported
3. Connect wallet
4. Navigate to NFT locking section
5. Follow UI to lock LP NFT
6. Set 365-day lock duration

**Research Required**:
- Verify Flare mainnet availability
- Check fee structure
- Test with small amount first

---

### Option 3: Custom ERC721 Timelock Contract

**Status**: Full control, requires Solidity knowledge

**Pros**:
- Complete control over locking logic
- No third-party fees
- Fully customizable
- Open-source and verifiable

**Cons**:
- Requires smart contract deployment
- Gas costs for deployment
- Self-auditing responsibility
- Community may prefer established lockers

**Sample Implementation**:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";

/**
 * @title SimpleLPLocker
 * @dev Time-locked NFT escrow for Uniswap V3 LP positions
 */
contract SimpleLPLocker is IERC721Receiver {
    address public immutable lpNftContract;
    uint256 public immutable lpTokenId;
    uint256 public immutable unlockTime;
    address public immutable beneficiary;
    
    bool public withdrawn;
    
    event Locked(uint256 tokenId, uint256 unlockTime);
    event Withdrawn(uint256 tokenId, address beneficiary);
    
    constructor(
        address _lpNftContract,
        uint256 _lpTokenId,
        uint256 _lockDurationSeconds,
        address _beneficiary
    ) {
        lpNftContract = _lpNftContract;
        lpTokenId = _lpTokenId;
        unlockTime = block.timestamp + _lockDurationSeconds;
        beneficiary = _beneficiary;
        withdrawn = false;
        
        emit Locked(_lpTokenId, unlockTime);
    }
    
    function withdraw() external {
        require(!withdrawn, "Already withdrawn");
        require(block.timestamp >= unlockTime, "Still locked");
        require(msg.sender == beneficiary, "Not beneficiary");
        
        withdrawn = true;
        IERC721(lpNftContract).safeTransferFrom(
            address(this),
            beneficiary,
            lpTokenId
        );
        
        emit Withdrawn(lpTokenId, beneficiary);
    }
    
    function onERC721Received(
        address,
        address,
        uint256,
        bytes calldata
    ) external pure override returns (bytes4) {
        return this.onERC721Received.selector;
    }
    
    function timeRemaining() external view returns (uint256) {
        if (block.timestamp >= unlockTime) {
            return 0;
        }
        return unlockTime - block.timestamp;
    }
}
```

**Deployment Steps**:

1. Create `contracts/SimpleLPLocker.sol` with above code
2. Deploy with constructor params:
   ```typescript
   const lpLocker = await ethers.deployContract("SimpleLPLocker", [
     SPARKDEX_POSITION_MANAGER, // NFT contract
     lpTokenId,                 // Token ID from deployment
     365 * 24 * 60 * 60,       // 12 months in seconds
     deployerAddress            // Beneficiary
   ]);
   ```
3. Transfer LP NFT to locker contract
4. Verify contract on block explorer
5. Announce lock to community with contract link

---

### Option 4: Gnosis Safe Multi-Sig + Timelock

**Status**: Enterprise-grade solution

**Pros**:
- Multi-signature security
- Modular architecture
- Can add timelock modules
- Transparent governance

**Cons**:
- More complex setup
- Requires multiple signers
- May not be necessary for solo founders

**How to Use**:
1. Create Gnosis Safe on Flare (check availability)
2. Add timelock module to safe
3. Transfer LP NFT to safe
4. Configure timelock for 365 days
5. Require majority signatures for early withdrawal

**Resources**:
- Gnosis Safe: https://safe.global/
- Check Flare mainnet deployment status

---

### Option 5: PinkSale / DxSale LP Lockers

**Status**: Check Flare availability

**Pros**:
- Popular in DeFi launches
- Simple UI
- Community trusted

**Cons**:
- Flare mainnet support unclear
- Service fees

**Research Required**:
- Verify Flare support
- Check compatibility with Uniswap V3 NFT positions

---

## Recommended Approach

### For Shield Finance Fair Launch:

**Primary**: Team Finance (if available on Flare)
- Industry standard
- Already integrated with Flare ecosystem
- SparkDEX uses it for SPRK

**Fallback**: Custom ERC721 Timelock
- Full control
- No dependencies
- Provably secure (if audited)
- Community can verify on-chain

### Decision Matrix:

| Priority | Solution | When to Use |
|----------|----------|-------------|
| 1st | Team Finance | If available on Flare mainnet |
| 2nd | Unicrypt | If Team Finance unavailable |
| 3rd | Custom Timelock | Maximum control desired |
| 4th | Gnosis Safe | Multi-sig governance needed |

---

## Verification After Locking

### Essential Checks:

1. **Verify on Block Explorer**:
   - Navigate to position manager: `0xEE5FF5Bc5F852764b5584d92A4d592A53DC527da`
   - Search for your LP token ID
   - Confirm new owner is the locker contract

2. **Screenshot Evidence**:
   - Locker interface showing lock details
   - Block explorer showing NFT transfer
   - Unlock timestamp

3. **Community Announcement**:
   ```
   🔒 LIQUIDITY LOCKED 🔒
   
   LP NFT Token ID: [your token ID]
   Lock Duration: 12 months (TBC)
   Unlock Date: [specific date]
   Locker Contract: [contract address]
   Verification: [block explorer link]
   
   Shield Finance is committed to long-term value creation!
   ```

4. **Update Documentation**:
   - Add lock details to project README
   - Update fair launch docs
   - Include in whitepaper/tokenomics

---

## Common Pitfalls to Avoid

❌ **Don't**:
- Lock with incorrect duration
- Use unverified locker contracts
- Lock wrong token ID
- Skip community announcement
- Forget to verify on explorer

✅ **Do**:
- Double-check all parameters
- Use established lockers when possible
- Verify contract code
- Announce publicly
- Keep lock proof accessible

---

## Post-Lock Actions

1. **Update Project Documentation**:
   - Add lock details to README.md
   - Update replit.md
   - Create announcement tweet/post

2. **Submit to Aggregators**:
   - DeFi trackers
   - Token listing sites
   - Security ratings platforms

3. **Prepare for Exchange Listings**:
   - Many CEXs require locked liquidity
   - Provide lock proof in listing applications

---

## Technical Details

### LP NFT Contract (SparkDEX V3):
- **Contract**: `0xEE5FF5Bc5F852764b5584d92A4d592A53DC527da`
- **Type**: ERC721 (Non-Fungible)
- **Represents**: Uniswap V3 liquidity position
- **Network**: Flare Mainnet (Chain ID: 14)

### Lock Duration:
- **Target**: 12 months (365 days) (TBC)
- **Seconds**: 31,536,000
- **Unlock Date**: 365 days from lock time

### Pool Details:
- **Pair**: wFLR/SHIELD
- **DEX**: SparkDEX V3
- **Fee Tier**: 0.3% (3000)
- **Initial Liquidity**: ~$10,000 USD (TBC)

---

## Support Resources

### If You Need Help:

1. **Flare Community**:
   - Discord: https://discord.gg/flarenetwork
   - Telegram: Check Flare official channels

2. **SparkDEX Support**:
   - Discord: SparkDEX community
   - Documentation: https://docs.sparkdex.ai/

3. **Team Finance**:
   - Support: Check their website for contact
   - Documentation: Team Finance docs

4. **Smart Contract Development**:
   - OpenZeppelin: https://docs.openzeppelin.com/
   - Hardhat: https://hardhat.org/

---

## Conclusion

Locking LP tokens is **not optional** for a credible fair launch. Choose the method that best fits your technical capabilities and community expectations. When in doubt, use Team Finance if available, or deploy a well-audited custom timelock contract.

**The integrity of Shield Finance depends on locked liquidity. Do not skip this step.**

---

## Quick Reference Commands

### Check LP NFT Ownership:
```bash
# Using Hardhat console
npx hardhat console --network flare

# In console:
const positionManager = await ethers.getContractAt(
  "INonfungiblePositionManager",
  "0xEE5FF5Bc5F852764b5584d92A4d592A53DC527da"
);
const owner = await positionManager.ownerOf(YOUR_TOKEN_ID);
console.log("Current owner:", owner);
```

### Verify Lock on Block Explorer:
```
https://flarescan.com/token/0xEE5FF5Bc5F852764b5584d92A4d592A53DC527da?a=[YOUR_TOKEN_ID]
```

### Calculate Unlock Timestamp:
```javascript
const lockStartTime = Math.floor(Date.now() / 1000);
const lockDuration = 365 * 24 * 60 * 60; // 12 months
const unlockTime = lockStartTime + lockDuration;
const unlockDate = new Date(unlockTime * 1000);
console.log("Unlock date:", unlockDate.toISOString());
```
