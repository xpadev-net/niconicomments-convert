const assert = require("node:assert/strict");
const { test } = require("node:test");
const { getConversionError } = require("../build/src/domain/conversion");
const load = require("./helpers/load-typescript.cjs");
const { str2time, time2str } = load("src/util/time.ts", {
  "@/util/zerofill": {},
});
const option = (overrides = {}) => ({
  fps: 30,
  width: 1920,
  height: 1080,
  options: {},
  ...overrides,
});

test("positive finite FPS, fractional rates, optional boundaries and explicit zero start are valid", () => {
  for (const fps of [1, 24, 29.97, 60]) {
    for (const clip of [{}, { ss: 0 }, { ss: 1, to: 2 }, { to: 10 }]) {
      assert.equal(getConversionError(option({ fps, ...clip }), 10), undefined);
    }
  }
});

test("nonpositive, nonfinite or nonnumeric FPS cannot enter the conversion domain", () => {
  for (const fps of [
    0,
    -1,
    NaN,
    Infinity,
    -Infinity,
    "30",
    "",
    null,
    undefined,
  ])
    assert.match(getConversionError(option({ fps }), 10), /FPS/);
});

test("clip boundaries must be finite, ordered, and within the video", () => {
  for (const clip of [
    { ss: -1 },
    { ss: 10 },
    { ss: NaN },
    { ss: Infinity },
    { ss: null },
    { to: 0 },
    { to: Infinity },
    { to: NaN },
    { to: null },
    { to: 11 },
    { ss: 2, to: 2 },
    { ss: 3, to: 2 },
  ])
    assert.ok(getConversionError(option(clip), 10));
  for (const duration of [0, -1, NaN, Infinity, "10", undefined])
    assert.ok(getConversionError(option(), duration));
});

test("invalid dimensions, scale, mode and switches are rejected", () => {
  for (const invalid of [
    { width: 0 },
    { height: 1.5 },
    { width: Infinity },
    { options: null },
    { options: { scale: 0 } },
    { options: { scale: NaN } },
    { options: { mode: "other" } },
    { options: { keepCA: "false" } },
  ])
    assert.ok(getConversionError(option(invalid), 10));
  assert.ok(getConversionError(option({ fps: Number.MAX_VALUE }), 10));
});

test("time parsing preserves an explicit zero and rejects overflow or invalid text", () => {
  assert.equal(str2time("00:00.00"), 0);
  assert.equal(time2str(0), "00:00.00");
  assert.equal(str2time("01:02.50"), 62.5);
  for (const text of ["-1", "NaN", "Infinity", "abc", "9".repeat(400)])
    assert.equal(str2time(text), undefined);
});
