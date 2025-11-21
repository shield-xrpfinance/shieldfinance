import { useState } from "react";
import WithdrawModal from "../WithdrawModal";
import { Button } from "@/components/ui/button";

export default function WithdrawModalExample() {
  const [open, setOpen] = useState(false);

  return (
    <div className="p-6">
      <Button onClick={() => setOpen(true)}>Open Withdraw Modal</Button>
      <WithdrawModal
        open={open}
        onOpenChange={setOpen}
        vaultName="XRP Stable Yield"
        depositedAmount="5,000"
        rewards="325.50"
        onConfirm={(amount) => {}}
      />
    </div>
  );
}
