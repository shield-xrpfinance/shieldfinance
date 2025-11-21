import PortfolioTable from "../PortfolioTable";

export default function PortfolioTableExample() {
  const positions = [
    {
      id: "pos-1",
      vaultName: "XRP Stable Yield",
      depositedAmount: "5,000",
      currentValue: "5,325.50",
      rewards: "325.50",
      apy: "7.5",
      depositDate: "Jan 15, 2025",
    },
    {
      id: "pos-2",
      vaultName: "XRP High Yield",
      depositedAmount: "3,000",
      currentValue: "3,284.00",
      rewards: "284.00",
      apy: "12.8",
      depositDate: "Feb 1, 2025",
    },
  ];

  return (
    <div className="p-6">
      <PortfolioTable
        positions={positions}
        onWithdraw={(id) => {}}
        onClaim={(id) => {}}
      />
    </div>
  );
}
