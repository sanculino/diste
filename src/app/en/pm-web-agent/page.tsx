import { PmwaPage, generatePmwaMetadata } from "@/components/product/PmwaPage";

export async function generateMetadata() {
  return generatePmwaMetadata("en");
}

export default function PmWebAgentEnPage() {
  return <PmwaPage locale="en" />;
}
