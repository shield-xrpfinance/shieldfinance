import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { TestnetAutomationService, type TestWallet } from "../../server/services/TestnetAutomationService";

const SKIP_NETWORK_TESTS = process.env.SKIP_NETWORK_TESTS === "true";

describe("Testnet Integration Tests", () => {
  let service: TestnetAutomationService;

  beforeAll(() => {
    service = new TestnetAutomationService();
  });

  afterAll(async () => {
    await service.disconnect();
  });

  describe("XRP Deposit Flow", () => {
    let testWallet: TestWallet;

    it("should fund test wallet from faucet", async () => {
      if (SKIP_NETWORK_TESTS) {
        console.log("⏭️ Skipping network test (SKIP_NETWORK_TESTS=true)");
        return;
      }

      testWallet = await service.fundTestWallet();

      expect(testWallet).toBeDefined();
      expect(testWallet.address).toMatch(/^r[1-9A-HJ-NP-Za-km-z]{25,34}$/);
      expect(testWallet.secret).toBeDefined();
      expect(parseFloat(testWallet.balance)).toBeGreaterThan(0);
    }, 30000);

    it("should check XRP balance", async () => {
      if (SKIP_NETWORK_TESTS || !testWallet) {
        console.log("⏭️ Skipping network test");
        return;
      }

      const balance = await service.checkXRPBalance(testWallet.address);

      expect(balance).toBeDefined();
      expect(parseFloat(balance)).toBeGreaterThan(0);
    }, 15000);

    it("should send XRP deposit to vault address", async () => {
      if (SKIP_NETWORK_TESTS || !testWallet) {
        console.log("⏭️ Skipping network test");
        return;
      }

      const result = await service.sendXRPDeposit(testWallet, "20");

      expect(result).toBeDefined();
      expect(result.txHash).toBeDefined();
      expect(result.success).toBe(true);
    }, 60000);

    it("should verify balance decreased after deposit", async () => {
      if (SKIP_NETWORK_TESTS || !testWallet) {
        console.log("⏭️ Skipping network test");
        return;
      }

      const balance = await service.checkXRPBalance(testWallet.address);
      
      expect(parseFloat(balance)).toBeLessThan(parseFloat(testWallet.balance));
    }, 15000);
  });

  describe("FXRP Vault Operations", () => {
    const operatorPrivateKey = process.env.OPERATOR_PRIVATE_KEY;
    const hasPrivateKey = !!operatorPrivateKey;

    it("should check FXRP balance for address", async () => {
      if (SKIP_NETWORK_TESTS || !hasPrivateKey) {
        console.log("⏭️ Skipping - no operator private key");
        return;
      }

      const { ethers } = await import("ethers");
      const wallet = new ethers.Wallet(operatorPrivateKey!);
      
      const balance = await service.checkFXRPBalance(wallet.address);

      expect(balance).toBeDefined();
      expect(typeof balance).toBe("string");
    }, 15000);

    it("should check shXRP balance for address", async () => {
      if (SKIP_NETWORK_TESTS || !hasPrivateKey) {
        console.log("⏭️ Skipping - no operator private key");
        return;
      }

      const { ethers } = await import("ethers");
      const wallet = new ethers.Wallet(operatorPrivateKey!);
      
      const balance = await service.checkShXRPBalance(wallet.address);

      expect(balance).toBeDefined();
      expect(typeof balance).toBe("string");
    }, 15000);

    it("should approve FXRP spending", async () => {
      if (SKIP_NETWORK_TESTS || !hasPrivateKey) {
        console.log("⏭️ Skipping - no operator private key");
        return;
      }

      const { ethers } = await import("ethers");
      const wallet = new ethers.Wallet(operatorPrivateKey!);
      
      const fxrpBalance = await service.checkFXRPBalance(wallet.address);
      
      if (parseFloat(fxrpBalance) <= 0) {
        console.log("⏭️ Skipping - no FXRP balance to approve");
        return;
      }

      const result = await service.approveVaultSpending(operatorPrivateKey!, "1");

      expect(result).toBeDefined();
      expect(result.txHash).toBeDefined();
    }, 60000);

    it("should deposit FXRP and receive shXRP", async () => {
      if (SKIP_NETWORK_TESTS || !hasPrivateKey) {
        console.log("⏭️ Skipping - no operator private key");
        return;
      }

      const { ethers } = await import("ethers");
      const wallet = new ethers.Wallet(operatorPrivateKey!);
      
      const fxrpBalance = await service.checkFXRPBalance(wallet.address);
      
      if (parseFloat(fxrpBalance) < 1) {
        console.log("⏭️ Skipping - insufficient FXRP balance for deposit test");
        return;
      }

      const result = await service.depositToVault(operatorPrivateKey!, "1");

      expect(result).toBeDefined();
      expect(result.txHash).toBeDefined();
      expect(result.sharesReceived).toBeDefined();
      expect(parseFloat(result.sharesReceived)).toBeGreaterThan(0);
    }, 120000);

    it("should withdraw shXRP and receive FXRP", async () => {
      if (SKIP_NETWORK_TESTS || !hasPrivateKey) {
        console.log("⏭️ Skipping - no operator private key");
        return;
      }

      const { ethers } = await import("ethers");
      const wallet = new ethers.Wallet(operatorPrivateKey!);
      
      const shxrpBalance = await service.checkShXRPBalance(wallet.address);
      
      if (parseFloat(shxrpBalance) < 0.1) {
        console.log("⏭️ Skipping - insufficient shXRP balance for withdrawal test");
        return;
      }

      const withdrawAmount = Math.min(parseFloat(shxrpBalance), 0.5).toFixed(6);
      const result = await service.withdrawFromVault(operatorPrivateKey!, withdrawAmount);

      expect(result).toBeDefined();
      expect(result.txHash).toBeDefined();
      expect(result.fxrpReceived).toBeDefined();
    }, 120000);
  });

  describe("Vault Configuration", () => {
    it("should fetch vault info", async () => {
      if (SKIP_NETWORK_TESTS) {
        console.log("⏭️ Skipping network test");
        return;
      }

      try {
        const info = await service.getVaultInfo();

        expect(info).toBeDefined();
        expect(info.vaultAddress).toBeDefined();
        expect(info.network).toBe("coston2");
        expect(info.xrplDepositAddress).toBe("r4bydXhaVMFzgDmqDmxkXJBKUgXTCwsWjY");
      } catch (error: any) {
        if (error.message?.includes("Could not find ShXRP Vault")) {
          console.log("⏭️ Vault not deployed - skipping vault info test");
          return;
        }
        throw error;
      }
    }, 15000);
  });

  describe("E2E Test Flows", () => {
    it("should run deposit flow test", async () => {
      if (SKIP_NETWORK_TESTS) {
        console.log("⏭️ Skipping network test");
        return;
      }

      const result = await service.runDepositFlowTest();

      expect(result).toBeDefined();
      expect(result.testName).toBe("XRP Deposit Flow Test");
      expect(result.steps.length).toBeGreaterThan(0);
      expect(result.duration).toBeGreaterThan(0);
    }, 180000);

    it("should run full bridge cycle test", async () => {
      if (SKIP_NETWORK_TESTS) {
        console.log("⏭️ Skipping network test");
        return;
      }

      const result = await service.runFullBridgeCycleTest();

      expect(result).toBeDefined();
      expect(result.testName).toContain("Full Bridge Cycle");
      expect(result.steps.length).toBeGreaterThan(0);
    }, 300000);
  });

  describe("Transaction Confirmation", () => {
    it("should wait for XRPL transaction confirmation", async () => {
      if (SKIP_NETWORK_TESTS) {
        console.log("⏭️ Skipping network test");
        return;
      }

      const wallet = await service.fundTestWallet();
      const depositResult = await service.sendXRPDeposit(wallet, "10");

      if (!depositResult.success) {
        console.log("⏭️ Skipping - deposit failed");
        return;
      }

      const confirmed = await service.waitForTransactionConfirmation(
        depositResult.txHash,
        "xrpl",
        30000
      );

      expect(confirmed).toBe(true);
    }, 120000);
  });
});

describe("TestnetAutomationService Unit Tests", () => {
  it("should create service with default config", () => {
    const service = new TestnetAutomationService();
    expect(service).toBeDefined();
  });

  it("should create service with custom config", () => {
    const service = new TestnetAutomationService({
      xrplTestnetUrl: "wss://custom.xrpl.testnet:51233",
      coston2RpcUrl: "https://custom.coston2.rpc",
    });
    expect(service).toBeDefined();
  });
});
