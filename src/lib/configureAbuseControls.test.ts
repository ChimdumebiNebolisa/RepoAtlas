import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  configureRateLimiterOnce: vi.fn(),
  inMemoryConstructor: vi.fn(),
  upstashConstructor: vi.fn(),
  upstashConfigFromEnv: vi.fn(),
}));

let configured = false;

vi.mock("@/lib/rateLimit", () => ({
  configureRateLimiterOnce: mocks.configureRateLimiterOnce,
  InMemoryRateLimiter: class {
    constructor() {
      mocks.inMemoryConstructor();
    }
  },
}));

vi.mock("@/lib/upstashRateLimit", () => ({
  UpstashRedisRateLimiter: class {
    constructor(url: string, token: string) {
      mocks.upstashConstructor(url, token);
    }
  },
  upstashConfigFromEnv: mocks.upstashConfigFromEnv,
}));

describe("configureAbuseControls", () => {
  beforeEach(() => {
    configured = false;
    vi.clearAllMocks();
    mocks.configureRateLimiterOnce.mockImplementation(
      (createLimiter: () => unknown) => {
        if (configured) return false;
        createLimiter();
        configured = true;
        return true;
      }
    );
  });

  it("selects the distributed limiter when valid configuration exists", async () => {
    mocks.upstashConfigFromEnv.mockReturnValue({
      url: "https://repoatlas.upstash.io",
      token: "test-token",
    });
    const { configureAbuseControls } = await import("./configureAbuseControls");

    configureAbuseControls();

    expect(mocks.upstashConstructor).toHaveBeenCalledOnce();
    expect(mocks.upstashConstructor).toHaveBeenCalledWith(
      "https://repoatlas.upstash.io",
      "test-token"
    );
    expect(mocks.inMemoryConstructor).not.toHaveBeenCalled();
  });

  it("selects the in-memory limiter when shared configuration is absent", async () => {
    mocks.upstashConfigFromEnv.mockReturnValue(null);
    const { configureAbuseControls } = await import("./configureAbuseControls");

    configureAbuseControls();

    expect(mocks.inMemoryConstructor).toHaveBeenCalledOnce();
    expect(mocks.upstashConstructor).not.toHaveBeenCalled();
  });

  it("does not replace the selected limiter on repeated startup", async () => {
    mocks.upstashConfigFromEnv.mockReturnValue(null);
    const { configureAbuseControls } = await import("./configureAbuseControls");

    configureAbuseControls();
    configureAbuseControls();

    expect(mocks.configureRateLimiterOnce).toHaveBeenCalledTimes(2);
    expect(mocks.upstashConfigFromEnv).toHaveBeenCalledOnce();
    expect(mocks.inMemoryConstructor).toHaveBeenCalledOnce();
  });

  it("keeps the selected limiter when the startup module reloads", async () => {
    mocks.upstashConfigFromEnv.mockReturnValue({
      url: "https://repoatlas.upstash.io",
      token: "test-token",
    });
    const firstModule = await import("./configureAbuseControls");

    firstModule.configureAbuseControls();
    vi.resetModules();
    const reloadedModule = await import("./configureAbuseControls");
    reloadedModule.configureAbuseControls();

    expect(mocks.configureRateLimiterOnce).toHaveBeenCalledTimes(2);
    expect(mocks.upstashConfigFromEnv).toHaveBeenCalledOnce();
    expect(mocks.upstashConstructor).toHaveBeenCalledOnce();
  });
});
