import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "今日训练 · WordRanger",
  description: "系统会安排今天最值得练的单词",
};

export default function DailyTrainingLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <div className="bg-background min-h-full">{children}</div>;
}
