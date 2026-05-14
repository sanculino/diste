import type { ReactNode } from "react";

type SectionProps = {
  id?: string;
  children: ReactNode;
  className?: string;
  innerClassName?: string;
};

export function Section({
  id,
  children,
  className = "",
  innerClassName = "",
}: SectionProps) {
  return (
    <section id={id} className={`scroll-mt-24 py-16 md:py-24 ${className}`}>
      <div
        className={`mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 ${innerClassName}`}
      >
        {children}
      </div>
    </section>
  );
}
