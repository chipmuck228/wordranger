export interface DebugToolLink {
  href: string;
  label: string;
}

export const DEBUG_TOOL_LINKS: readonly DebugToolLink[] = [
  { href: "/debug/vocabulary", label: "词汇调试" },
  { href: "/debug/tasks", label: "任务协议调试" },
  { href: "/debug/scheduler", label: "调度器调试" },
  { href: "/debug/learning", label: "Learning Core 调试" },
  { href: "/debug/contextual-content-review", label: "内容审核工具" },
];
