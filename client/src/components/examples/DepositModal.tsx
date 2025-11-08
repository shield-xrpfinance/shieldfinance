import { useState } from "react";
import DepositModal from "../DepositModal";
import { Button } from "@/components/ui/button";

export default function DepositModalExample() {
  const [open, setOpen] = useState(false);

  return (
    <div className="p-6">
      <Button onClick={() => setOpen(true)}>Open Deposit Modal</Button>
      <DepositModal
        open={open}
        onOpenChange={setOpen}
        vaultName="XRP Stable Yield"
        vaultApy="7.5"
        onConfirm={(amount) => console.log("Deposited:", amount)}
      />
    </div>
  );
}
