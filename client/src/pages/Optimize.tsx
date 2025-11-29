import YieldOptimizer from "@/components/YieldOptimizer";

export default function Optimize() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Yield Optimizer</h1>
        <p className="text-muted-foreground mt-2">
          One-click strategies to maximize your returns based on risk preferences
        </p>
      </div>
      
      <YieldOptimizer />
    </div>
  );
}
