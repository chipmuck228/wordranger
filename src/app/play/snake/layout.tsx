import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "贪食蛇 · WordRanger",
  description: "控制小蛇，吃到正确答案",
};

export default function SnakeLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <div className="bg-background min-h-full">{children}</div>;
}
