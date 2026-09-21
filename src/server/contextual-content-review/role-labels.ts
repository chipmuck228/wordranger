const ROLE_LABELS: Record<string, string> = {
  DRINK_CONTAINER: "饮料容器",
  DRINK: "饮料",
  FOOD_CONTAINER: "食物容器",
  FOOD_SUPPORT: "承托食物",
  SUPPORTED_FOOD: "盘中食物",
  FOOD: "食物",
  EATING_TOOL: "餐具",
  EATER: "用餐者",
};

export function reviewRoleLabel(roleId: string): string {
  return ROLE_LABELS[roleId] ?? roleId;
}
