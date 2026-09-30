import { cn } from "@/lib/utils";

export function Badge({
  className,
  tone = "navy",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & {
  tone?: "navy" | "saffron" | "green" | "red" | "slate";
}) {
  const tones = {
    navy: "bg-navy text-white",
    saffron: "bg-saffron/20 text-navy border border-saffron/40",
    green: "bg-india-green/15 text-india-green border border-india-green/30",
    red: "bg-red-100 text-red-900 border border-red-200",
    slate: "bg-slate-100 text-slate-700",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold tracking-wide",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}
