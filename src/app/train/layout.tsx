import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "自由练习 · WordRanger",
  description: "单词由系统根据当前学习情况安排",
};

export default function DailyTrainingLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <div className="bg-background min-h-full">{children}</div>;
}
