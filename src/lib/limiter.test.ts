import { describe, expect, it } from "vitest";
import { createLimiter } from "./limiter";

describe("createLimiter", () => {
  it("never runs more than the limit at once and runs everything in order", async () => {
    const run = createLimiter(3);
    let active = 0;
    let peak = 0;
    const order: number[] = [];
    const tasks = Array.from({ length: 10 }, (_, i) =>
      run(async () => {
        active++;
        peak = Math.max(peak, active);
        order.push(i);
        await new Promise((r) => setTimeout(r, 5));
        active--;
        return i;
      }),
    );
    expect(await Promise.all(tasks)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(peak).toBe(3);
    expect(order).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it("keeps going after a task fails", async () => {
    const run = createLimiter(1);
    await expect(run(() => Promise.reject(new Error("x")))).rejects.toThrow("x");
    expect(await run(async () => "ok")).toBe("ok");
  });
});
