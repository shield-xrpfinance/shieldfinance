#!/usr/bin/env npx tsx
import { TestnetAutomationService } from "../server/services/TestnetAutomationService";

interface CliArgs {
  all: boolean;
  deposit: boolean;
  withdraw: boolean;
  bridgeCycle: boolean;
  fundWallet: boolean;
  checkBalance: boolean;
  address?: string;
  vaultInfo: boolean;
  help: boolean;
}

function printUsage(): void {
  console.log(`
╔══════════════════════════════════════════════════════════════════╗
║           Shield Finance Testnet Automation CLI                  ║
╚══════════════════════════════════════════════════════════════════╝

USAGE:
  npx tsx scripts/testnet-automation.ts [options]

TEST SCENARIOS:
  --all               Run all test scenarios
  --deposit           Run XRP deposit flow test
  --withdraw          Run FXRP withdrawal flow test  
  --bridge-cycle      Run full bridge cycle test (XRP → FXRP → shXRP)

UTILITY COMMANDS:
  --fund-wallet       Fund a new test wallet from XRPL faucet
  --check-balance     Check XRP/FXRP/shXRP balance
    --address <addr>  Address to check (XRP or EVM address)
  --vault-info        Display vault configuration and status

OTHER:
  --help              Show this help message

EXAMPLES:
  # Run all tests
  npx tsx scripts/testnet-automation.ts --all

  # Run specific test
  npx tsx scripts/testnet-automation.ts --deposit

  # Fund a test wallet
  npx tsx scripts/testnet-automation.ts --fund-wallet

  # Check balances
  npx tsx scripts/testnet-automation.ts --check-balance --address rXXXXXX

ENVIRONMENT VARIABLES:
  OPERATOR_PRIVATE_KEY    Private key for Coston2 operations
  VITE_SHXRP_VAULT_ADDRESS  Override vault address

NOTES:
  - Uses XRPL Testnet (wss://s.altnet.rippletest.net:51233)
  - Uses Coston2 Testnet (https://coston2-api.flare.network/ext/C/rpc)
  - Vault deposit address: r4bydXhaVMFzgDmqDmxkXJBKUgXTCwsWjY
`);
}

function parseArgs(args: string[]): CliArgs {
  const result: CliArgs = {
    all: false,
    deposit: false,
    withdraw: false,
    bridgeCycle: false,
    fundWallet: false,
    checkBalance: false,
    vaultInfo: false,
    help: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case "--all":
        result.all = true;
        break;
      case "--deposit":
        result.deposit = true;
        break;
      case "--withdraw":
        result.withdraw = true;
        break;
      case "--bridge-cycle":
        result.bridgeCycle = true;
        break;
      case "--fund-wallet":
        result.fundWallet = true;
        break;
      case "--check-balance":
        result.checkBalance = true;
        break;
      case "--address":
        result.address = args[++i];
        break;
      case "--vault-info":
        result.vaultInfo = true;
        break;
      case "--help":
      case "-h":
        result.help = true;
        break;
    }
  }

  return result;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printUsage();
    process.exit(0);
  }

  const hasAction = args.all || args.deposit || args.withdraw || args.bridgeCycle || 
                    args.fundWallet || args.checkBalance || args.vaultInfo;

  if (!hasAction) {
    printUsage();
    process.exit(1);
  }

  const service = new TestnetAutomationService();

  try {
    if (args.fundWallet) {
      console.log("\n🚀 Funding new test wallet from XRPL faucet...\n");
      const wallet = await service.fundTestWallet();
      
      console.log("\n╔══════════════════════════════════════════════════════════════════╗");
      console.log("║                    NEW TEST WALLET CREATED                       ║");
      console.log("╚══════════════════════════════════════════════════════════════════╝");
      console.log(`\n  Address: ${wallet.address}`);
      console.log(`  Secret:  ${wallet.secret}`);
      console.log(`  Balance: ${wallet.balance} XRP\n`);
      console.log("⚠️  Save the secret securely - it cannot be recovered!\n");
    }

    if (args.checkBalance) {
      if (!args.address) {
        console.error("❌ Error: --address is required with --check-balance");
        process.exit(1);
      }

      console.log(`\n📊 Checking balances for: ${args.address}\n`);

      const isEvmAddress = args.address.startsWith("0x");
      const isXrplAddress = args.address.startsWith("r");

      if (isXrplAddress) {
        try {
          const xrpBalance = await service.checkXRPBalance(args.address);
          console.log(`  XRP Balance:  ${xrpBalance} XRP`);
        } catch (error) {
          console.log(`  XRP Balance:  Unable to fetch (${error})`);
        }
      }

      if (isEvmAddress) {
        try {
          const fxrpBalance = await service.checkFXRPBalance(args.address);
          console.log(`  FXRP Balance: ${fxrpBalance} FXRP`);
        } catch (error) {
          console.log(`  FXRP Balance: Unable to fetch (${error})`);
        }

        try {
          const shxrpBalance = await service.checkShXRPBalance(args.address);
          console.log(`  shXRP Balance: ${shxrpBalance} shXRP`);
        } catch (error) {
          console.log(`  shXRP Balance: Unable to fetch (${error})`);
        }
      }

      if (!isEvmAddress && !isXrplAddress) {
        console.error("❌ Invalid address format. Must start with 'r' (XRPL) or '0x' (EVM)");
        process.exit(1);
      }

      console.log("");
    }

    if (args.vaultInfo) {
      console.log("\n📋 Fetching vault information...\n");
      const info = await service.getVaultInfo();
      
      console.log("╔══════════════════════════════════════════════════════════════════╗");
      console.log("║                    VAULT CONFIGURATION                           ║");
      console.log("╚══════════════════════════════════════════════════════════════════╝");
      console.log(`\n  Network:           ${info.network}`);
      console.log(`  Vault Address:     ${info.vaultAddress}`);
      console.log(`  FXRP Address:      ${info.fxrpAddress}`);
      console.log(`  XRP Deposit Addr:  ${info.xrplDepositAddress}`);
      console.log(`\n  Total Assets:      ${info.totalAssets} FXRP`);
      console.log(`  Total Supply:      ${info.totalSupply} shXRP`);
      console.log(`  Deposit Limit:     ${info.depositLimit} FXRP`);
      console.log(`  Min Deposit:       ${info.minDeposit} FXRP`);
      console.log(`  Paused:            ${info.paused ? "Yes" : "No"}\n`);
    }

    if (args.deposit) {
      const result = await service.runDepositFlowTest();
      printTestResult(result);
    }

    if (args.withdraw) {
      const result = await service.runWithdrawFlowTest();
      printTestResult(result);
    }

    if (args.bridgeCycle) {
      const result = await service.runFullBridgeCycleTest();
      printTestResult(result);
    }

    if (args.all) {
      const results = await service.runAllTests();
      
      console.log("\n╔══════════════════════════════════════════════════════════════════╗");
      console.log("║                    FINAL TEST SUMMARY                            ║");
      console.log("╚══════════════════════════════════════════════════════════════════╝\n");
      
      for (const result of results) {
        const icon = result.success ? "✅" : "❌";
        console.log(`  ${icon} ${result.testName}`);
        console.log(`     Duration: ${result.duration}ms`);
        if (result.error) {
          console.log(`     Error: ${result.error}`);
        }
        console.log("");
      }

      const passed = results.filter(r => r.success).length;
      const total = results.length;
      const allPassed = passed === total;
      
      console.log(`  Result: ${passed}/${total} tests passed\n`);
      
      process.exit(allPassed ? 0 : 1);
    }

    await service.disconnect();
    process.exit(0);

  } catch (error) {
    console.error("\n❌ Fatal error:", error);
    await service.disconnect();
    process.exit(1);
  }
}

function printTestResult(result: { testName: string; success: boolean; duration: number; steps: any[]; error?: string; summary: string }): void {
  console.log("\n╔══════════════════════════════════════════════════════════════════╗");
  console.log(`║  TEST: ${result.testName.padEnd(55)}║`);
  console.log("╚══════════════════════════════════════════════════════════════════╝\n");

  console.log("Steps:");
  for (const step of result.steps) {
    const icon = step.success ? "✅" : "❌";
    console.log(`  ${icon} ${step.name} (${step.duration}ms)`);
    if (step.details) {
      for (const [key, value] of Object.entries(step.details)) {
        console.log(`     ${key}: ${value}`);
      }
    }
    if (step.error) {
      console.log(`     Error: ${step.error}`);
    }
  }

  console.log(`\n${result.summary}\n`);
}

main().catch(console.error);
