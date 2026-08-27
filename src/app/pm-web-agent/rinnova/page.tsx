import Link from "next/link";
import { RenewPmwa } from "@/components/product/RenewPmwa";
import { getDictionary } from "@/i18n/get-dictionary";

export async function generateMetadata() {
  const dict = await getDictionary("it");
  return {
    title: dict.pmwa.renewal.metaTitle,
    description: dict.pmwa.renewal.metaDescription,
  };
}

export default async function RinnovaPage() {
  const dict = await getDictionary("it");
  return (
    <main className="min-h-screen bg-slate-50 py-12">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <Link href="/pm-web-agent" className="text-sm font-semibold text-diste-blue">
          ← {dict.pmwa.ctaBack}
        </Link>
        <div className="mt-6">
          <RenewPmwa locale="it" dict={dict.pmwa} />
        </div>
      </div>
    </main>
  );
}
