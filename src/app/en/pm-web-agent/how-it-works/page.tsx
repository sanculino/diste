import { GuidePage, guideMetadata } from "@/components/product/GuidePage";
import { getDictionary } from "@/i18n/get-dictionary";

export function generateMetadata() {
  return guideMetadata("en");
}

export default async function HowItWorksPage() {
  const dict = await getDictionary("en");
  return <GuidePage locale="en" dict={dict.pmwa} />;
}
