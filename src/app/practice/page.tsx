import { notFound } from "next/navigation";
import { isFreePracticePageAvailable } from "@/server/free-practice/runtime-policy";
import { FreePracticeClient } from "./free-practice-client";

export const dynamic = "force-dynamic";

export default function FreePracticePage() {
  if (!isFreePracticePageAvailable()) {
    notFound();
  }
  return <FreePracticeClient />;
}
