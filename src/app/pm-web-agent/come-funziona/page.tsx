import { GuidePage, guideMetadata } from "@/components/product/GuidePage";
import { getDictionary } from "@/i18n/get-dictionary";

export function generateMetadata() {
  return guideMetadata("it");
}

export default async function ComeFunzionaPage() {
  const dict = await getDictionary("it");
  return <GuidePage locale="it" dict={dict.pmwa} />;
}
