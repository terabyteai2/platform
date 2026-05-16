import { Suspense } from "react";
import { ReviewFlow } from "@/components/ReviewFlow";

export default function ReviewPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-xl mx-auto px-4 pt-12 text-center">
          <p className="text-[#7a7163]">লোড হচ্ছে...</p>
        </div>
      }
    >
      <ReviewFlow />
    </Suspense>
  );
}
