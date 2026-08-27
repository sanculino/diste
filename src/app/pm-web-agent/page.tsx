import { PmwaPage, generatePmwaMetadata } from "@/components/product/PmwaPage";

export async function generateMetadata() {
  return generatePmwaMetadata("it");
}

export default function PmWebAgentPage() {
  return <PmwaPage locale="it" />;
}
