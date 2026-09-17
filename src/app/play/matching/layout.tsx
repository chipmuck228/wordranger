import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "连连看 · WordRanger",
  description: "先点左边，再找到右边最合适的一项",
};

export default function MatchingLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <div className="bg-background min-h-full">{children}</div>;
}
