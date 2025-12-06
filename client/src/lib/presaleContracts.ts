import { SHIELD_CONTRACTS, PAYMENT_TOKENS } from "@shared/layerzero-config";

export const PRESALE_ADDRESSES = {
  114: { // Coston2
    presale: SHIELD_CONTRACTS.testnet.coston2.presale,
    paymentToken: SHIELD_CONTRACTS.testnet.coston2.paymentToken,
  },
  84532: { // Base Sepolia
    presale: SHIELD_CONTRACTS.testnet.baseSepolia.presale,
    paymentToken: PAYMENT_TOKENS.testnets.baseSepolia,
  },
  421614: { // Arbitrum Sepolia
    presale: SHIELD_CONTRACTS.testnet.arbitrumSepolia.presale,
    paymentToken: PAYMENT_TOKENS.testnets.arbitrumSepolia,
  },
  11155111: { // Sepolia
    presale: SHIELD_CONTRACTS.testnet.sepolia.presale,
    paymentToken: PAYMENT_TOKENS.testnets.sepolia,
  },
} as const;

export const SHIELD_PRESALE_ABI = [
  {
    inputs: [],
    name: "currentStage",
    outputs: [{ type: "uint256", name: "" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "totalRaised",
    outputs: [{ type: "uint256", name: "" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "totalParticipants",
    outputs: [{ type: "uint256", name: "" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "isActive",
    outputs: [{ type: "bool", name: "" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ type: "uint256", name: "stageId" }],
    name: "stages",
    outputs: [
      { type: "uint256", name: "price" },
      { type: "uint256", name: "allocation" },
      { type: "uint256", name: "sold" },
      { type: "uint256", name: "startTime" },
      { type: "uint256", name: "endTime" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ type: "address", name: "user" }],
    name: "purchases",
    outputs: [
      { type: "uint256", name: "totalPurchased" },
      { type: "uint256", name: "totalPaid" },
      { type: "uint256", name: "vestingStart" },
      { type: "uint256", name: "claimed" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { type: "uint256", name: "_usdAmount" },
      { type: "bytes32", name: "_referralCode" },
      { type: "bytes32[]", name: "_allowlistProof" },
      { type: "bytes32[]", name: "_kycProof" },
    ],
    name: "buy",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "claim",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ type: "address", name: "user" }],
    name: "claimable",
    outputs: [{ type: "uint256", name: "" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

export const ERC20_ABI = [
  {
    inputs: [{ type: "address", name: "account" }],
    name: "balanceOf",
    outputs: [{ type: "uint256", name: "" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { type: "address", name: "spender" },
      { type: "uint256", name: "amount" },
    ],
    name: "approve",
    outputs: [{ type: "bool", name: "" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { type: "address", name: "owner" },
      { type: "address", name: "spender" },
    ],
    name: "allowance",
    outputs: [{ type: "uint256", name: "" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "decimals",
    outputs: [{ type: "uint8", name: "" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

export const TOKEN_ADDRESSES: Record<number, Record<string, string>> = {
  114: { // Coston2
    FLR: "0x0000000000000000000000000000000000000000", // Native
    WFLR: "0xC67DCE33D7A8efA5FfEB961899C73fe01bCe9273",
    FXRP: "0x26d7AdC0e70F2b53990d8D66a48Cb5532bd56F2F",
    "USDC.e": "0x4Ba749c96F6B0c9AddF3a339eb7E79A5f92C7C39",
  },
  84532: { // Base Sepolia
    ETH: "0x0000000000000000000000000000000000000000", // Native
    WETH: "0x4200000000000000000000000000000000000006",
    USDC: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
  },
  421614: { // Arbitrum Sepolia
    ETH: "0x0000000000000000000000000000000000000000", // Native
    USDC: "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d",
    ARB: "0x0000000000000000000000000000000000000000", // Placeholder
  },
  11155111: { // Sepolia
    ETH: "0x0000000000000000000000000000000000000000", // Native
    WETH: "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14",
    USDC: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
  },
};
