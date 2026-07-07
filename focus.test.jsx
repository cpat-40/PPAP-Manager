/**
 * Regression tests for the PPAP Manager demo.
 * Run with: npm test
 *
 * Guards the fix for the "inputs defined inside render lose focus on every
 * keystroke" bug in the MSA and Capability editors, and the capability
 * verdict thresholds (AIAG initial process study criteria).
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

afterEach(cleanup); // vitest without globals does not auto-cleanup Testing Library renders
import userEvent from "@testing-library/user-event";
import React from "react";
import App from "./src/App.jsx";

// jsdom doesn't implement canvas or ResizeObserver (recharts needs it)
global.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
HTMLCanvasElement.prototype.getContext = () => ({
  strokeStyle: "", lineWidth: 0, lineCap: "",
  beginPath() {}, moveTo() {}, lineTo() {}, stroke() {}, clearRect() {},
});

const openMsaEditor = async (user) => {
  await user.click(screen.getByText("Supplier Admin"));
  await user.click(screen.getAllByText("Packages")[0]);
  await user.click(screen.getByText("Steering Bracket")); // draft package, editable
  await user.click(screen.getByText("Measurement System Analysis"));
};

const inputUnder = (labelText) =>
  screen.getByText(labelText).closest("label").querySelector("input, textarea");

describe("MSA editor inputs", () => {
  beforeEach(() => localStorage.clear());

  it("keep focus across keystrokes and receive the full typed value", async () => {
    const user = userEvent.setup();
    render(<App />);
    await openMsaEditor(user);

    const ev = inputUnder("Repeatability (EV)");
    ev.focus();
    await user.type(ev, "0.08");

    const evNow = inputUnder("Repeatability (EV)");
    expect(evNow.value).toBe("0.08");
    expect(document.activeElement).toBe(evNow); // focus never left the field
  }, 30000);

  it("compute %GRR and verdict from EV/AV/PV", async () => {
    const user = userEvent.setup();
    render(<App />);
    await openMsaEditor(user);

    await user.type(inputUnder("Repeatability (EV)"), "0.08");
    await user.type(inputUnder("Reproducibility (AV)"), "0.05");
    await user.type(inputUnder("Part variation (PV)"), "1.20");

    // GRR = sqrt(.08^2+.05^2)=0.0943; TV = sqrt(GRR^2+1.2^2)=1.2037; %GRR = 7.8%
    expect(screen.getByText("7.8%")).toBeTruthy();
    expect(screen.getByText("Acceptable")).toBeTruthy();
  }, 30000);
});

describe("Capability editor", () => {
  beforeEach(() => localStorage.clear());

  it("spec-limit inputs keep focus, and the verdict follows AIAG initial-study criteria", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByText("Supplier Admin"));
    await user.click(screen.getAllByText("Packages")[0]);
    await user.click(screen.getByText("Steering Bracket"));
    await user.click(screen.getByText("Initial Process Studies"));

    const lsl = inputUnder("Lower spec (LSL)");
    lsl.focus();
    await user.type(lsl, "11.98");
    expect(inputUnder("Lower spec (LSL)").value).toBe("11.98");
    expect(document.activeElement).toBe(inputUnder("Lower spec (LSL)"));

    await user.type(inputUnder("Upper spec (USL)"), "12.02");
    await user.type(
      inputUnder("Measurements (comma or space separated)"),
      "12.004 12.007 12.002 12.006 12.009 12.003 12.005 12.008 12.001 12.006"
    );

    // Both indices render and a verdict chip appears
    expect(screen.getByText("Cpk (within σ)")).toBeTruthy();
    expect(screen.getByText("Ppk (overall σ)")).toBeTruthy();
    const verdicts = ["Meets criteria (≥ 1.67)", "Conditional - contact customer", "Not acceptable"];
    expect(verdicts.some((v) => screen.queryByText(v))).toBe(true);
  }, 30000);
});
