import StatsCard from "../StatsCard";
import { Coins } from "lucide-react";

export default function StatsCardExample() {
  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 p-6">
      <StatsCard
        label="Total Value Locked"
        value="$24.5M"
        change={{ value: 12.5, positive: true }}
        icon={<Coins className="h-6 w-6" />}
      />
      <StatsCard
        label="Average APY"
        value="8.2%"
        change={{ value: 0.8, positive: true }}
      />
      <StatsCard
        label="Active Vaults"
        value="12"
      />
      <StatsCard
        label="Total Stakers"
        value="3,421"
        change={{ value: 5.2, positive: true }}
      />
    </div>
  );
}
