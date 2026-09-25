import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "自由练习 · WordRanger",
  description: "选择一组单词，按自己的节奏练习。",
};

export default function FreePracticeLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <div className="bg-background min-h-full">{children}</div>;
}
