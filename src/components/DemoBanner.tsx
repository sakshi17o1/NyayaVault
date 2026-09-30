import { FICTIONAL_BANNER } from "@/lib/constants";

export function DemoBanner() {
  return (
    <div
      role="status"
      className="border-b border-saffron/40 bg-saffron/15 px-4 py-2 text-center text-xs font-medium text-navy"
    >
      {FICTIONAL_BANNER}
    </div>
  );
}
