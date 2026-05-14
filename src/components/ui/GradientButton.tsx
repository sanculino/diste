import type { ComponentProps } from "react";

type GradientButtonProps = ComponentProps<"a"> & {
  variant?: "primary" | "outline";
};

export function GradientButton({
  variant = "primary",
  className = "",
  children,
  ...props
}: GradientButtonProps) {
  const base =
    "inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-semibold transition duration-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-diste-azure";

  if (variant === "outline") {
    return (
      <a
        {...props}
        className={`${base} border border-slate-200 bg-white/80 text-foreground shadow-sm backdrop-blur hover:border-diste-azure/40 hover:shadow-md ${className}`}
      >
        {children}
      </a>
    );
  }

  return (
    <a
      {...props}
      className={`${base} bg-gradient-to-r from-diste-blue via-diste-azure to-diste-green text-white shadow-lg shadow-diste-blue/25 hover:brightness-110 hover:shadow-xl ${className}`}
    >
      {children}
    </a>
  );
}
