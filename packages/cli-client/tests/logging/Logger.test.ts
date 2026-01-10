import { expect, test, describe, spyOn, beforeEach } from "bun:test";
import { logger, LogLevel } from "../../src/logging/Logger";
import { OutputLevel } from "../../src/types";

describe("Enhanced Logger", () => {
  let consoleSpy: any;

  beforeEach(() => {
    consoleSpy = spyOn(console, "log").mockImplementation(() => {});
    consoleSpy.mockClear();
    logger.configure({ structured: false });
  });

  test("should filter logs based on OutputLevel", () => {
    logger.configure({ outputLevel: OutputLevel.QUIET });
    logger.debug("test debug");
    logger.info("test info");
    logger.error("test error");

    expect(consoleSpy).toHaveBeenCalledTimes(1);
    expect(consoleSpy.mock.calls[0][0]).toContain("[ERROR] test error");
  });

  test("should support structured logging", () => {
    logger.configure({ outputLevel: OutputLevel.NORMAL, structured: true });
    logger.info("test structured", { key: "value" });

    expect(consoleSpy).toHaveBeenCalledTimes(1);
    const output = JSON.parse(consoleSpy.mock.calls[0][0]);
    expect(output.message).toBe("test structured");
    expect(output.data.key).toBe("value");
    expect(output.level).toBe("INFO");
  });

  test("should respect verbose level", () => {
    logger.configure({ outputLevel: OutputLevel.VERBOSE });
    logger.debug("debug message");
    expect(consoleSpy).toHaveBeenCalledTimes(1);
    expect(consoleSpy.mock.calls[0][0]).toContain("[DEBUG] debug message");
  });
});
