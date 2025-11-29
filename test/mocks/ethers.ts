import { vi } from "vitest";

export interface MockProviderOptions {
  blockNumber?: number;
  shouldFail?: boolean;
  chainId?: number;
}

export function createMockProvider(options: MockProviderOptions = {}) {
  const { blockNumber = 12345678, shouldFail = false, chainId = 114 } = options;

  return {
    getBlockNumber: vi.fn().mockImplementation(() => {
      if (shouldFail) {
        return Promise.reject(new Error("Provider error"));
      }
      return Promise.resolve(blockNumber);
    }),
    getNetwork: vi.fn().mockResolvedValue({ chainId }),
    getBalance: vi.fn().mockResolvedValue(BigInt("1000000000000000000")),
    getTransactionReceipt: vi.fn().mockImplementation((txHash: string) => {
      if (shouldFail) {
        return Promise.reject(new Error("Transaction not found"));
      }
      return Promise.resolve({
        hash: txHash,
        blockNumber,
        status: 1,
        logs: [],
        gasUsed: BigInt("21000"),
        effectiveGasPrice: BigInt("20000000000"),
      });
    }),
    waitForTransaction: vi.fn().mockImplementation((txHash: string) => {
      if (shouldFail) {
        return Promise.reject(new Error("Transaction failed"));
      }
      return Promise.resolve({
        hash: txHash,
        blockNumber,
        status: 1,
      });
    }),
    getLogs: vi.fn().mockResolvedValue([]),
    call: vi.fn().mockResolvedValue("0x"),
    estimateGas: vi.fn().mockResolvedValue(BigInt("21000")),
    getFeeData: vi.fn().mockResolvedValue({
      gasPrice: BigInt("20000000000"),
      maxFeePerGas: BigInt("30000000000"),
      maxPriorityFeePerGas: BigInt("1500000000"),
    }),
  };
}

export function createMockSigner(address?: string) {
  const signerAddress = address || "0x1234567890123456789012345678901234567890";

  return {
    getAddress: vi.fn().mockResolvedValue(signerAddress),
    signMessage: vi.fn().mockResolvedValue("0xmocksignature"),
    signTransaction: vi.fn().mockResolvedValue("0xsignedtx"),
    sendTransaction: vi.fn().mockResolvedValue({
      hash: "0xmocktxhash1234567890123456789012345678901234567890123456789012345678",
      wait: vi.fn().mockResolvedValue({
        status: 1,
        blockNumber: 12345678,
      }),
    }),
    connect: vi.fn().mockReturnThis(),
    provider: createMockProvider(),
  };
}

export function createMockContract(contractAddress?: string) {
  const address = contractAddress || "0x9876543210987654321098765432109876543210";

  const mockContract = {
    target: address,
    getAddress: vi.fn().mockResolvedValue(address),
    totalSupply: vi.fn().mockResolvedValue(BigInt("1000000000000")),
    balanceOf: vi.fn().mockResolvedValue(BigInt("100000000")),
    decimals: vi.fn().mockResolvedValue(6),
    symbol: vi.fn().mockResolvedValue("FXRP"),
    name: vi.fn().mockResolvedValue("FAsset XRP"),
    allowance: vi.fn().mockResolvedValue(BigInt("0")),
    approve: vi.fn().mockResolvedValue({
      hash: "0xapprovetxhash",
      wait: vi.fn().mockResolvedValue({ status: 1 }),
    }),
    transfer: vi.fn().mockResolvedValue({
      hash: "0xtransfertxhash",
      wait: vi.fn().mockResolvedValue({ status: 1 }),
    }),
    deposit: vi.fn().mockResolvedValue({
      hash: "0xdeposittxhash",
      wait: vi.fn().mockResolvedValue({ status: 1 }),
    }),
    withdraw: vi.fn().mockResolvedValue({
      hash: "0xwithdrawtxhash",
      wait: vi.fn().mockResolvedValue({ status: 1 }),
    }),
    redeem: vi.fn().mockResolvedValue({
      hash: "0xredeemtxhash",
      wait: vi.fn().mockResolvedValue({ status: 1 }),
    }),
    depositLimit: vi.fn().mockResolvedValue(BigInt("100000000000")),
    paused: vi.fn().mockResolvedValue(false),
    totalAssets: vi.fn().mockResolvedValue(BigInt("50000000000")),
    convertToShares: vi.fn().mockImplementation((assets: bigint) => assets),
    convertToAssets: vi.fn().mockImplementation((shares: bigint) => shares),
    queryFilter: vi.fn().mockResolvedValue([]),
    filters: {
      Transfer: vi.fn().mockReturnValue({}),
      Deposit: vi.fn().mockReturnValue({}),
      Withdraw: vi.fn().mockReturnValue({}),
      MintingExecuted: vi.fn().mockReturnValue({}),
    },
    on: vi.fn(),
    off: vi.fn(),
    removeAllListeners: vi.fn(),
  };

  return mockContract;
}

export const mockTransferEvent = {
  transactionHash: "0xmocktxhash1234567890123456789012345678901234567890123456789012345678",
  blockNumber: 12345678,
  args: {
    from: "0x0000000000000000000000000000000000000000",
    to: "0x1234567890123456789012345678901234567890",
    value: BigInt("100000000"),
  },
  topics: [
    "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef",
    "0x0000000000000000000000000000000000000000000000000000000000000000",
    "0x0000000000000000000000001234567890123456789012345678901234567890",
  ],
  data: "0x0000000000000000000000000000000000000000000000000000000005f5e100",
};

export const mockMintingExecutedEvent = {
  transactionHash: "0xminttxhash1234567890123456789012345678901234567890123456789012345678",
  blockNumber: 12345678,
  args: [
    BigInt("12345"),
    "0xAgentVaultAddress1234567890123456789012",
    "0xPoolAddress1234567890123456789012345678",
    BigInt("100000000"),
    BigInt("1000000"),
  ],
};
