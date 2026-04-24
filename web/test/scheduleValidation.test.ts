import { describe, it, expect } from "vitest";
import {
  blocksOverlap,
  findOverlaps,
  validateScheduleBlock,
  minutesToTimeString,
  timeStringToMinutes,
  type ScheduleBlockData,
} from "@/lib/schedule/scheduleValidation";

// helpers
const block = (overrides: Partial<ScheduleBlockData> & { dia: number; horaInicio: number; horaFin: number }): ScheduleBlockData =>
  ({ id: "a", ...overrides });

describe("blocksOverlap", () => {
  it("returns false for different days", () => {
    expect(blocksOverlap(
      block({ dia: 1, horaInicio: 480, horaFin: 600 }),
      block({ dia: 2, horaInicio: 480, horaFin: 600 }),
    )).toBe(false);
  });

  it("returns false for adjacent blocks (no gap)", () => {
    expect(blocksOverlap(
      block({ dia: 1, horaInicio: 480, horaFin: 570 }),
      block({ dia: 1, horaInicio: 570, horaFin: 660 }),
    )).toBe(false);
  });

  it("returns false for block before another", () => {
    expect(blocksOverlap(
      block({ dia: 1, horaInicio: 480, horaFin: 540 }),
      block({ dia: 1, horaInicio: 600, horaFin: 720 }),
    )).toBe(false);
  });

  it("returns true for fully contained block", () => {
    expect(blocksOverlap(
      block({ dia: 1, horaInicio: 480, horaFin: 720 }),
      block({ dia: 1, horaInicio: 540, horaFin: 660 }),
    )).toBe(true);
  });

  it("returns true for partial overlap at the start", () => {
    expect(blocksOverlap(
      block({ dia: 3, horaInicio: 480, horaFin: 600 }),
      block({ dia: 3, horaInicio: 540, horaFin: 660 }),
    )).toBe(true);
  });

  it("returns true for partial overlap at the end", () => {
    expect(blocksOverlap(
      block({ dia: 3, horaInicio: 540, horaFin: 660 }),
      block({ dia: 3, horaInicio: 480, horaFin: 570 }),
    )).toBe(true);
  });

  it("returns true for identical blocks", () => {
    expect(blocksOverlap(
      block({ dia: 2, horaInicio: 600, horaFin: 720 }),
      block({ dia: 2, horaInicio: 600, horaFin: 720 }),
    )).toBe(true);
  });
});

describe("findOverlaps", () => {
  const existing: ScheduleBlockData[] = [
    { id: "1", dia: 1, horaInicio: 480, horaFin: 570 },
    { id: "2", dia: 1, horaInicio: 600, horaFin: 720 },
    { id: "3", dia: 2, horaInicio: 480, horaFin: 570 },
  ];

  it("returns empty when no overlaps", () => {
    expect(findOverlaps({ dia: 1, horaInicio: 720, horaFin: 840 }, existing)).toHaveLength(0);
  });

  it("finds one overlap", () => {
    const result = findOverlaps({ dia: 1, horaInicio: 540, horaFin: 660 }, existing);
    expect(result.map((b) => b.id)).toEqual(["1", "2"]);
  });

  it("skips the block being edited (same id)", () => {
    const editing: ScheduleBlockData = { id: "1", dia: 1, horaInicio: 480, horaFin: 570 };
    expect(findOverlaps(editing, existing)).toHaveLength(0);
  });

  it("only checks same day", () => {
    const result = findOverlaps({ dia: 3, horaInicio: 480, horaFin: 570 }, existing);
    expect(result).toHaveLength(0);
  });
});

describe("validateScheduleBlock", () => {
  const valid = block({ dia: 1, horaInicio: 480, horaFin: 570 });

  it("accepts a valid block", () => {
    expect(validateScheduleBlock(valid)).toBeNull();
  });

  it("rejects dia 0", () => {
    expect(validateScheduleBlock({ ...valid, dia: 0 })).not.toBeNull();
  });

  it("rejects dia 6", () => {
    expect(validateScheduleBlock({ ...valid, dia: 6 })).not.toBeNull();
  });

  it("rejects negative horaInicio", () => {
    expect(validateScheduleBlock({ ...valid, horaInicio: -1 })).not.toBeNull();
  });

  it("rejects horaFin <= horaInicio", () => {
    expect(validateScheduleBlock({ ...valid, horaFin: valid.horaInicio })).not.toBeNull();
    expect(validateScheduleBlock({ ...valid, horaFin: valid.horaInicio - 1 })).not.toBeNull();
  });

  it("rejects horaFin > 1440", () => {
    expect(validateScheduleBlock({ ...valid, horaFin: 1441 })).not.toBeNull();
  });

  it("rejects non-integer dia", () => {
    expect(validateScheduleBlock({ ...valid, dia: 1.5 })).not.toBeNull();
  });
});

describe("minutesToTimeString / timeStringToMinutes", () => {
  it("converts 480 to 08:00", () => {
    expect(minutesToTimeString(480)).toBe("08:00");
  });

  it("converts 570 to 09:30", () => {
    expect(minutesToTimeString(570)).toBe("09:30");
  });

  it("round-trips", () => {
    expect(timeStringToMinutes(minutesToTimeString(735))).toBe(735);
  });
});
