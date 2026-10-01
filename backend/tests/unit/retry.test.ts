import { describe, expect, it, vi } from "vitest";
import { retryWithBackoff } from "../../src/shared/retry";

describe("retryWithBackoff", () => {
  it("retries transient failures and returns the first successful result", async () => {
    vi.useFakeTimers();
    const operation = vi.fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error("temporary"))
      .mockRejectedValueOnce(new Error("temporary"))
      .mockResolvedValue("ready");
    const result = retryWithBackoff(operation, 5, 10);
    await vi.runAllTimersAsync();
    await expect(result).resolves.toBe("ready");
    expect(operation).toHaveBeenCalledTimes(3);
    vi.useRealTimers();
  });

  it("stops after the configured number of attempts", async () => {
    vi.useFakeTimers();
    const failure = new Error("offline");
    const operation = vi.fn<() => Promise<void>>().mockRejectedValue(failure);
    const result = retryWithBackoff(operation, 3, 5);
    await vi.runAllTimersAsync();
    await expect(result).rejects.toBe(failure);
    expect(operation).toHaveBeenCalledTimes(3);
    vi.useRealTimers();
  });
});
