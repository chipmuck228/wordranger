/** @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MealSceneCard } from "@/components/context-lab/MealSceneCard";
import type { PublicContextPresentation } from "@/components/context-lab/types";

const BASE: PublicContextPresentation = {
  title: "早餐时间",
  settingLabel: "教学阶段：建立小刀的情境记忆",
  instruction: "这是教学，不是测试。",
  entities: [{ id: "home-knife", label: "小刀", role: "TOOL" }],
  highlightedEntityIds: ["home-knife"],
};

describe("MealSceneCard support presentation", () => {
  afterEach(() => {
    cleanup();
  });

  it("labels knife TEACH fields and hides missing modules", () => {
    render(
      <MealSceneCard
        context={{
          ...BASE,
          supportReveal: {
            kind: "LEXICAL_FORM",
            lexicalForm: "knife",
            meaningGloss: "小刀",
            phonetic: "/naɪf/",
            inflectionNote: "复数 knives",
            note: "这是教学，不是测试。",
          },
        }}
      />,
    );
    expect(screen.getByText("英文")).toBeTruthy();
    expect(screen.getByText("knife")).toBeTruthy();
    expect(screen.getByText("意思")).toBeTruthy();
    expect(screen.getByText("小刀", { selector: "dd" })).toBeTruthy();
    expect(screen.getByText("读音")).toBeTruthy();
    expect(screen.getByText("/naɪf/")).toBeTruthy();
    expect(screen.getByText("词形")).toBeTruthy();
    expect(screen.getByText("复数 knives")).toBeTruthy();
    expect(screen.queryByText("—")).toBeNull();
  });

  it("hides inflection and contrast when those approved fields are absent", () => {
    render(
      <MealSceneCard
        context={{
          ...BASE,
          settingLabel: "教学阶段：建立面包的情境记忆",
          entities: [{ id: "home-bread", label: "面包", role: "FOOD" }],
          highlightedEntityIds: ["home-bread"],
          supportReveal: {
            kind: "LEXICAL_FORM",
            lexicalForm: "bread",
            meaningGloss: "面包",
            phonetic: "/bred/",
            note: "这是教学，不是测试。",
          },
        }}
      />,
    );
    expect(screen.getAllByText("英文").length).toBeGreaterThan(0);
    expect(screen.getByText("bread")).toBeTruthy();
    expect(screen.queryByText("词形")).toBeNull();
    expect(screen.queryByLabelText("用途对比")).toBeNull();
    expect(screen.queryByText("—")).toBeNull();
  });

  it("shows only the spelling cue on FADE", () => {
    render(
      <MealSceneCard
        context={{
          ...BASE,
          supportReveal: {
            kind: "SPELLING_CUE",
            spellingCue: "k _ _ _ _",
            note: "这是拼写提示，不是完整答案。",
          },
        }}
      />,
    );
    expect(screen.getByLabelText("拼写提示").textContent).toBe("k _ _ _ _");
    expect(screen.queryByText("英文")).toBeNull();
    expect(screen.queryByText("knife")).toBeNull();
  });
});
