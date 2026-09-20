import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Context Lab · WordRanger",
  description: "Internal contextual learning presentation pilot",
};

export default function ContextLabLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <div className="bg-background min-h-dvh">{children}</div>;
}
