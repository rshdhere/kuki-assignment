import { Suspense } from "react";
import { FactsView } from "@/components/facts-view";

export default function FactsPage() {
  return (
    <Suspense>
      <FactsView />
    </Suspense>
  );
}
