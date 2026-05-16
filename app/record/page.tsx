import { Suspense } from "react";
import { RecordFlow } from "@/components/RecordFlow";

export default function RecordPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-xl mx-auto px-4 pt-12 text-center">
          <p className="text-[#7a7163]">লোড হচ্ছে...</p>
        </div>
      }
    >
      <RecordFlow />
    </Suspense>
  );
}
