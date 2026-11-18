export function TestnetBanner() {
  return (
    <div
      className="fixed top-0 inset-x-0 z-[70] bg-amber-400 text-black text-center text-sm font-semibold py-2 px-4"
      data-testid="banner-testnet"
      role="status"
    >
      Testnet (Coston2) — not yet on mainnet
    </div>
  );
}
