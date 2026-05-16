import { Suspense } from "react";
import { ResultsPage } from "@/components/ResultsPage";

export const dynamic = "force-dynamic";

export default function Results() {
  return (
    <Suspense
      fallback={
        <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-12">
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-12 rounded-[6px] bg-[#e2ddd1] animate-pulse" />
            ))}
          </div>
        </div>
      }
    >
      <ResultsPage />
    </Suspense>
  );
}
