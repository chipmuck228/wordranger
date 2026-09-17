import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "单词闯关 · WordRanger",
  description: "自由练习：点选或输入，大约 8 题",
};

export default function RangerTrialLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="ranger-trial-pilot-root min-h-dvh">{children}</div>
  );
}
