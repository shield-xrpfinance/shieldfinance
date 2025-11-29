import { vi } from "vitest";

export interface MockXrplClientOptions {
  isConnected?: boolean;
  shouldFail?: boolean;
}

export function createMockXrplClient(options: MockXrplClientOptions = {}) {
  const { isConnected = true, shouldFail = false } = options;

  const mockClient = {
    connect: vi.fn().mockImplementation(() => {
      if (shouldFail) {
        return Promise.reject(new Error("Connection failed"));
      }
      return Promise.resolve();
    }),
    disconnect: vi.fn().mockResolvedValue(undefined),
    isConnected: vi.fn().mockReturnValue(isConnected),
    request: vi.fn().mockImplementation((params: { command: string }) => {
      if (shouldFail) {
        return Promise.reject(new Error("Request failed"));
      }

      switch (params.command) {
        case "account_info":
          return Promise.resolve({
            result: {
              account_data: {
                Account: "rTestAccount123456789012345678901",
                Balance: "100000000",
                Sequence: 12345,
              },
            },
          });
        case "tx":
          return Promise.resolve({
            result: {
              validated: true,
              meta: {
                TransactionResult: "tesSUCCESS",
              },
              hash: "ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890",
            },
          });
        case "submit":
          return Promise.resolve({
            result: {
              engine_result: "tesSUCCESS",
              tx_blob: "ABCDEF1234567890",
              tx_json: {
                hash: "ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890",
              },
            },
          });
        case "ledger":
          return Promise.resolve({
            result: {
              ledger: {
                ledger_index: 12345678,
                close_time: Math.floor(Date.now() / 1000),
              },
            },
          });
        default:
          return Promise.resolve({ result: {} });
      }
    }),
    on: vi.fn(),
    removeAllListeners: vi.fn(),
  };

  return mockClient;
}

export function createMockXrplWallet() {
  return {
    address: "rTestWalletAddress123456789",
    publicKey: "ED1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890ABCD",
    privateKey: "ED1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890ABCD",
    seed: "sTestSeed123456789",
    sign: vi.fn().mockReturnValue({
      tx_blob: "SIGNED_TX_BLOB_1234567890",
      hash: "SIGNED_TX_HASH_1234567890",
    }),
  };
}

export const mockTransactionResponses = {
  paymentSuccess: {
    result: {
      validated: true,
      meta: {
        TransactionResult: "tesSUCCESS",
        delivered_amount: "1000000",
      },
      hash: "SUCCESS_TX_HASH_1234567890ABCDEF1234567890ABCDEF1234567890ABC",
      ledger_index: 12345678,
    },
  },
  paymentPending: {
    result: {
      validated: false,
      hash: "PENDING_TX_HASH_1234567890ABCDEF1234567890ABCDEF1234567890ABC",
    },
  },
  paymentFailed: {
    result: {
      validated: true,
      meta: {
        TransactionResult: "tecNO_TARGET",
      },
      hash: "FAILED_TX_HASH_1234567890ABCDEF1234567890ABCDEF1234567890ABCD",
    },
  },
};

export const mockAccountInfo = {
  result: {
    account_data: {
      Account: "rTestAccount123456789012345678901",
      Balance: "50000000000",
      Sequence: 100,
      Flags: 0,
    },
    ledger_current_index: 12345678,
    validated: true,
  },
};
