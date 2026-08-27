import { GuidePage, guideMetadata } from "@/components/product/GuidePage";

export function generateMetadata() {
  return guideMetadata("en");
}

export default function HowItWorksPage() {
  return <GuidePage locale="en" />;
}
