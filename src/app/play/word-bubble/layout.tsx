import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "单词泡泡 · WordRanger",
  description: "看清题目，点中正确的泡泡",
};

export default function WordBubbleLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <div className="bg-background min-h-full">{children}</div>;
}
