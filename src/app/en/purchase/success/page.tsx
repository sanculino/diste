import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { PurchaseSuccessClient } from "@/components/product/PurchaseSuccessClient";

type Props = {
  searchParams: Promise<{ order?: string }>;
};

export default async function PurchaseSuccessEnPage({ searchParams }: Props) {
  const sp = await searchParams;
  const orderId = (sp.order || "").trim();

  return (
    <>
      <Header />
      <main>
        {orderId ? (
          <PurchaseSuccessClient locale="en" orderId={orderId} />
        ) : (
          <div className="mx-auto max-w-xl px-4 py-16 text-center text-slate-600">
            Order not specified.
          </div>
        )}
      </main>
      <Footer />
    </>
  );
}
