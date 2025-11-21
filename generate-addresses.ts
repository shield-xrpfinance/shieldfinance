import { ethers } from "ethers";

// Generate 20 valid checksummed addresses
const addresses = [];
for (let i = 0; i < 20; i++) {
  const wallet = ethers.Wallet.createRandom();
  addresses.push({
    address: wallet.address,
    amount: "100000"
  });
}

console.log(JSON.stringify(addresses, null, 2));
