import { GuidePage, guideMetadata } from "@/components/product/GuidePage";

export function generateMetadata() {
  return guideMetadata("it");
}

export default function ComeFunzionaPage() {
  return <GuidePage locale="it" />;
}
