import Image from "next/image";

/** Percorso versionato: cambia nome file se serve invalidare cache CDN/browser. */
export const LOGO_SRC = "/logo-v2.png";

const variants = {
  header: {
    width: 422,
    height: 236,
    className: "h-[5.265rem] w-auto max-w-[min(84vw,28rem)] sm:h-[6.435rem]",
  },
  footer: {
    width: 468,
    height: 263,
    className: "h-[7.02rem] w-auto max-w-full rounded-md bg-white px-2 py-1",
  },
} as const;

type BrandLogoProps = {
  variant?: keyof typeof variants;
  priority?: boolean;
};

export function BrandLogo({ variant = "header", priority }: BrandLogoProps) {
  const { width, height, className } = variants[variant];

  return (
    <Image
      src={LOGO_SRC}
      alt="DI.S.TE. MANAGEMENT S.a.s."
      width={width}
      height={height}
      className={className}
      priority={priority ?? variant === "header"}
      unoptimized
      sizes={
        variant === "header"
          ? "(max-width: 640px) 84vw, 422px"
          : "(max-width: 768px) 90vw, 468px"
      }
    />
  );
}
