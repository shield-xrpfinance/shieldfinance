import { useState } from "react";
import DepositModal from "../DepositModal";
import { Button } from "@/components/ui/button";

export default function DepositModalExample() {
  const [open, setOpen] = useState(false);

  return (
    <div className="p-6">
      <Button onClick={() => setOpen(true)}>Open Deposit Modal (Dual Asset)</Button>
      <DepositModal
        open={open}
        onOpenChange={setOpen}
        vaultName="RLUSD + USDC Pool"
        vaultApy="12.8"
        depositAssets={["RLUSD", "USDC"]}
        onConfirm={(amounts) => {}}
      />
    </div>
  );
}
