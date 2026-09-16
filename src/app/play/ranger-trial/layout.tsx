import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "单词闯关 · WordRanger",
  description: "根据你目前的学习情况练习单词",
};

export default function RangerTrialLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="bg-background min-h-full">{children}</div>
  );
}
