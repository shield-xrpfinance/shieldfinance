// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IFirelightVault {
    function convertToAssets(uint256 shares) external view returns (uint256);
}

/**
 * @title Shield XRP Vault (shXRP)
 * @dev ERC-4626 compliant tokenized vault for XRP on Flare Network
 * 
 * Architecture:
 * - Asset: FXRP (FAssets-wrapped XRP on Flare Network)
 * - Shares: shXRP (liquid staking token, ERC-20 compliant)
 * - Standard: ERC-4626 (Tokenized Vault Standard)
 * 
 * Features:
 * - Deposit FXRP → Receive shXRP shares (automatic exchange rate)
 * - Redeem shXRP → Receive FXRP (proportional to vault performance)
 * - Operator-controlled for bridging coordination
 * - Firelight.finance integration for DeFi yield strategies
 * - ReentrancyGuard for deposit/withdrawal security
 * 
 * Flow:
 * 1. User mints FXRP via FAssets bridge (XRP → FXRP on Flare)
 * 2. User approves FXRP spending for this vault
 * 3. User calls deposit() with FXRP amount → Receives shXRP shares
 * 4. Vault deploys FXRP to Firelight for yield (4-7% APY)
 * 5. shXRP value increases as Firelight generates returns
 * 6. User calls withdraw() with shXRP → Receives FXRP + accrued yield
 * 
 * ERC-4626 Benefits:
 * - Standard interface for all DeFi integrations
 * - Automatic share price calculation (no manual exchange rate)
 * - Compatible with lending protocols, DEXs, aggregators
 * - Transparent vault accounting via totalAssets()
 * 
 * Integration Notes:
 * - FXRP: See docs/FLARE_FASSETS_INTEGRATION.md
 * - Firelight: See docs/FIRELIGHT_INTEGRATION.md
 * - Operators coordinate bridging between XRPL and Flare
 */
contract ShXRPVault is ERC4626, Ownable, ReentrancyGuard {
    
    // Mapping of approved operators who can manage Firelight deposits
    mapping(address => bool) public operators;
    
    // Minimum deposit amount (0.01 FXRP with 6 decimals)
    uint256 public minDeposit = 10000; // 0.01 FXRP (6 decimals)
    
    // Firelight.finance Integration
    // Firelight provides institutional-grade liquid staking for FXRP
    address public firelightVault;           // Firelight Launch Vault (ERC-4626)
    uint256 public totalStXRPDeposited;      // stXRP balance from Firelight deposits
    
    // Events
    event OperatorAdded(address indexed operator);
    event OperatorRemoved(address indexed operator);
    event MinDepositUpdated(uint256 newMinDeposit);
    event FirelightVaultSet(address indexed firelightVault);
    event FirelightDeposit(uint256 fxrpAmount, uint256 stXRPReceived);
    event FirelightWithdraw(uint256 stXRPAmount, uint256 fxrpReceived);
    
    modifier onlyOperator() {
        require(operators[msg.sender] || msg.sender == owner(), "Not authorized");
        _;
    }
    
    /**
     * @dev Constructor
     * @param _fxrpToken Address of FXRP token (FAssets-wrapped XRP)
     * @param _name Name of the share token (e.g., "Shield XRP")
     * @param _symbol Symbol of the share token (e.g., "shXRP")
     * 
     * Example deployment:
     * FXRP Mainnet: 0xAd552A648C74D49E10027AB8a618A3ad4901c5bE
     * FXRP Coston2: 0xa3Bd00D652D0f28D2417339322A51d4Fbe2B22D3
     */
    constructor(
        IERC20 _fxrpToken,
        string memory _name,
        string memory _symbol
    ) ERC4626(_fxrpToken) ERC20(_name, _symbol) Ownable(msg.sender) {
        require(address(_fxrpToken) != address(0), "Invalid FXRP token address");
        
        // Deployer is first operator
        operators[msg.sender] = true;
        emit OperatorAdded(msg.sender);
    }
    
    /**
     * @dev Override decimals to match the underlying FXRP asset (6 decimals)
     * 
     * OpenZeppelin ERC20 defaults to 18 decimals, but FXRP uses 6.
     * This ensures all ERC4626 math (convertToShares, convertToAssets, etc.)
     * works correctly with 6-decimal FXRP values.
     * 
     * @return uint8 Number of decimals (inherited from FXRP)
     */
    function decimals() public view virtual override(ERC20, ERC4626) returns (uint8) {
        return IERC20Metadata(address(asset())).decimals();
    }
    
    /**
     * @dev Calculate total assets under management
     * 
     * ERC-4626 Required Function
     * This drives the share price calculation:
     * Share Price = totalAssets() / totalSupply()
     * 
     * Assets Include:
     * 1. FXRP held directly in this vault
     * 2. FXRP deployed to Firelight (valued via stXRP position)
     * 
     * As Firelight generates yield, totalAssets() increases,
     * automatically increasing the value of shXRP shares.
     * 
     * @return Total FXRP-equivalent assets in the vault
     */
    function totalAssets() public view virtual override returns (uint256) {
        // FXRP held directly in vault
        uint256 vaultBalance = IERC20(asset()).balanceOf(address(this));
        
        // Add Firelight stXRP position value (if Firelight vault is set)
        if (firelightVault != address(0) && totalStXRPDeposited > 0) {
            // stXRP is ERC-4626, so we can get asset value directly
            try IFirelightVault(firelightVault).convertToAssets(totalStXRPDeposited) returns (uint256 firelightValue) {
                vaultBalance += firelightValue;
            } catch {
                // If conversion fails, use 1:1 ratio as fallback
                vaultBalance += totalStXRPDeposited;
            }
        }
        
        return vaultBalance;
    }
    
    /**
     * @dev Deposit FXRP and receive shXRP shares
     * 
     * Overrides ERC-4626 deposit to add:
     * - Minimum deposit enforcement
     * - Reentrancy protection
     * 
     * Standard ERC-4626 Flow:
     * 1. User approves FXRP spending: fxrp.approve(vault, amount)
     * 2. User calls deposit(amount, receiver)
     * 3. Vault transfers FXRP from user
     * 4. Vault mints shXRP shares to receiver
     * 
     * Share Calculation (automatic):
     * shares = (assets * totalSupply()) / totalAssets()
     * 
     * @param assets Amount of FXRP to deposit
     * @param receiver Address to receive shXRP shares
     * @return shares Amount of shXRP shares minted
     */
    function deposit(uint256 assets, address receiver) 
        public 
        virtual 
        override 
        nonReentrant 
        returns (uint256) 
    {
        require(assets >= minDeposit, "Below minimum deposit");
        return super.deposit(assets, receiver);
    }
    
    /**
     * @dev Mint exact amount of shXRP shares
     * 
     * Overrides ERC-4626 mint to add:
     * - Minimum deposit enforcement (via asset preview)
     * - Reentrancy protection
     * 
     * Use Case:
     * When user wants exact number of shares, not exact FXRP amount
     * 
     * @param shares Amount of shXRP shares to mint
     * @param receiver Address to receive shXRP shares
     * @return assets Amount of FXRP deposited
     */
    function mint(uint256 shares, address receiver) 
        public 
        virtual 
        override 
        nonReentrant 
        returns (uint256) 
    {
        uint256 assets = previewMint(shares);
        require(assets >= minDeposit, "Below minimum deposit");
        return super.mint(shares, receiver);
    }
    
    /**
     * @dev Withdraw FXRP by burning shXRP shares
     * 
     * Adds reentrancy protection to standard ERC-4626 withdraw
     * 
     * Standard ERC-4626 Flow:
     * 1. User calls withdraw(assets, receiver, owner)
     * 2. Vault burns shXRP from owner
     * 3. Vault transfers FXRP to receiver
     * 
     * @param assets Amount of FXRP to withdraw
     * @param receiver Address to receive FXRP
     * @param owner Address whose shXRP will be burned
     * @return shares Amount of shXRP burned
     */
    function withdraw(uint256 assets, address receiver, address owner)
        public
        virtual
        override
        nonReentrant
        returns (uint256)
    {
        return super.withdraw(assets, receiver, owner);
    }
    
    /**
     * @dev Redeem shXRP shares for FXRP
     * 
     * Adds reentrancy protection to standard ERC-4626 redeem
     * 
     * Use Case:
     * When user wants to burn exact number of shares
     * 
     * @param shares Amount of shXRP to redeem
     * @param receiver Address to receive FXRP
     * @param owner Address whose shXRP will be burned
     * @return assets Amount of FXRP withdrawn
     */
    function redeem(uint256 shares, address receiver, address owner)
        public
        virtual
        override
        nonReentrant
        returns (uint256)
    {
        return super.redeem(shares, receiver, owner);
    }
    
    // ========================================
    // OPERATOR MANAGEMENT
    // ========================================
    
    /**
     * @dev Add an operator who can manage Firelight deposits
     * 
     * Operators coordinate:
     * - Deploying idle FXRP to Firelight for yield
     * - Withdrawing from Firelight when users redeem
     * - Rebalancing between vault and Firelight
     * 
     * @param operator Address of the operator
     */
    function addOperator(address operator) external onlyOwner {
        require(operator != address(0), "Invalid operator address");
        operators[operator] = true;
        emit OperatorAdded(operator);
    }
    
    /**
     * @dev Remove an operator
     * @param operator Address of the operator
     */
    function removeOperator(address operator) external onlyOwner {
        operators[operator] = false;
        emit OperatorRemoved(operator);
    }
    
    // ========================================
    // ADMIN FUNCTIONS
    // ========================================
    
    /**
     * @dev Update minimum deposit amount
     * @param newMinDeposit New minimum deposit (FXRP has 6 decimals)
     * 
     * Example: 0.01 FXRP = 10000 (0.01 * 10^6)
     */
    function setMinDeposit(uint256 newMinDeposit) external onlyOwner {
        require(newMinDeposit > 0, "Min deposit must be positive");
        minDeposit = newMinDeposit;
        emit MinDepositUpdated(newMinDeposit);
    }
    
    /**
     * @dev Set Firelight vault address for yield integration
     * 
     * Firelight Launch Vault (ERC-4626):
     * - Accepts FXRP deposits
     * - Returns stXRP shares
     * - Generates 4-7% APY from institutional staking
     * 
     * Integration Flow:
     * 1. Set firelightVault address (this function)
     * 2. Operator calls depositToFirelight() to deploy idle FXRP
     * 3. Firelight generates yield on staked FXRP
     * 4. totalAssets() includes stXRP value (increases shXRP price)
     * 
     * @param _firelightVault Address of Firelight Launch Vault
     * 
     * See docs/FIRELIGHT_INTEGRATION.md for contract addresses
     */
    function setFirelightVault(address _firelightVault) external onlyOwner {
        require(_firelightVault != address(0), "Invalid Firelight vault");
        firelightVault = _firelightVault;
        emit FirelightVaultSet(_firelightVault);
    }
    
    // ========================================
    // FIRELIGHT INTEGRATION (FUTURE)
    // ========================================
    
    /**
     * @dev Deploy idle FXRP to Firelight for yield generation
     * 
     * TODO: Implement when Firelight contracts are deployed
     * 
     * Implementation Plan:
     * 1. Check FXRP balance in vault
     * 2. Approve Firelight vault to spend FXRP
     * 3. Call Firelight.deposit(amount, address(this))
     * 4. Receive stXRP shares
     * 5. Track stXRP balance in totalStXRPDeposited
     * 6. Update totalAssets() to include stXRP value
     * 
     * @param amount Amount of FXRP to deposit to Firelight
     * 
     * Example:
     * function depositToFirelight(uint256 amount) external onlyOperator {
     *     require(firelightVault != address(0), "Firelight not configured");
     *     require(amount > 0, "Amount must be positive");
     *     
     *     IERC20 fxrp = IERC20(asset());
     *     require(fxrp.balanceOf(address(this)) >= amount, "Insufficient FXRP");
     *     
     *     // Approve and deposit to Firelight
     *     fxrp.approve(firelightVault, amount);
     *     uint256 stXRPReceived = IFirelightVault(firelightVault).deposit(amount, address(this));
     *     
     *     // Track stXRP position
     *     totalStXRPDeposited += stXRPReceived;
     *     
     *     emit FirelightDeposit(amount, stXRPReceived);
     * }
     */
    
    /**
     * @dev Withdraw FXRP from Firelight when users redeem
     * 
     * TODO: Implement when Firelight contracts are deployed
     * 
     * Implementation Plan:
     * 1. Calculate stXRP amount to redeem
     * 2. Call Firelight.redeem(stXRPAmount, address(this), address(this))
     * 3. Receive FXRP (includes accrued yield)
     * 4. Update totalStXRPDeposited
     * 5. FXRP now available for user withdrawals
     * 
     * @param stXRPAmount Amount of stXRP to redeem from Firelight
     * 
     * Example:
     * function withdrawFromFirelight(uint256 stXRPAmount) external onlyOperator {
     *     require(firelightVault != address(0), "Firelight not configured");
     *     require(stXRPAmount > 0, "Amount must be positive");
     *     require(totalStXRPDeposited >= stXRPAmount, "Insufficient stXRP");
     *     
     *     // Redeem from Firelight
     *     uint256 fxrpReceived = IFirelightVault(firelightVault).redeem(
     *         stXRPAmount,
     *         address(this),
     *         address(this)
     *     );
     *     
     *     // Update stXRP tracking
     *     totalStXRPDeposited -= stXRPAmount;
     *     
     *     emit FirelightWithdraw(stXRPAmount, fxrpReceived);
     * }
     */
    
    // ========================================
    // VIEW FUNCTIONS
    // ========================================
    
    /**
     * @dev Get the underlying asset (FXRP token address)
     * 
     * Inherited from ERC4626, but documented for clarity
     * 
     * @return Address of FXRP token
     */
    // function asset() public view override returns (address)
    // Already implemented in ERC4626
    
    /**
     * @dev Preview how many shares will be minted for asset amount
     * 
     * Inherited from ERC4626
     * Formula: shares = (assets * totalSupply()) / totalAssets()
     * 
     * @param assets Amount of FXRP to deposit
     * @return shares Amount of shXRP that will be minted
     */
    // function previewDeposit(uint256 assets) public view override returns (uint256)
    // Already implemented in ERC4626
    
    /**
     * @dev Preview how many assets are needed for share amount
     * 
     * Inherited from ERC4626
     * Formula: assets = (shares * totalAssets()) / totalSupply()
     * 
     * @param shares Amount of shXRP to mint
     * @return assets Amount of FXRP needed
     */
    // function previewMint(uint256 shares) public view override returns (uint256)
    // Already implemented in ERC4626
    
    /**
     * @dev Preview how many shares will be burned for asset withdrawal
     * 
     * Inherited from ERC4626
     * 
     * @param assets Amount of FXRP to withdraw
     * @return shares Amount of shXRP that will be burned
     */
    // function previewWithdraw(uint256 assets) public view override returns (uint256)
    // Already implemented in ERC4626
    
    /**
     * @dev Preview how many assets will be received for share redemption
     * 
     * Inherited from ERC4626
     * 
     * @param shares Amount of shXRP to redeem
     * @return assets Amount of FXRP that will be received
     */
    // function previewRedeem(uint256 shares) public view override returns (uint256)
    // Already implemented in ERC4626
    
    /**
     * @dev Returns the number of decimals (6, matches FXRP)
     * 
     * Note: shXRP inherits decimals from the underlying FXRP asset (6 decimals)
     * Inherited from ERC4626 which uses the same decimals as the underlying asset
     * 
     * @return uint8 Number of decimals
     */
    // function decimals() public view override returns (uint8)
    // Already implemented in ERC4626, automatically matches FXRP's 6 decimals
}
