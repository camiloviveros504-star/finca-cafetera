import { describe, expect, it } from "vitest";
import { aCsv } from "../../src/app/_servidor/csv";

describe("CSV del servidor", () => {
  it("escapa comillas, comas y saltos de línea, y agrega BOM para Excel", () => {
    const csv = aCsv(["a", "b"], [['dice "hola", ok', "línea\nnueva"]]);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toContain('"dice ""hola"", ok"');
    expect(csv).toContain('"línea\nnueva"');
  });

  it("neutraliza fórmulas (= + - @) pero no los números negativos", () => {
    const csv = aCsv(["x"], [["=HYPERLINK(\"http://malo\")"], ["+cmd"], ["@SUM(A1)"], ["-5.50"], ["-texto"]]);
    expect(csv).toContain("'=HYPERLINK");
    expect(csv).toContain("'+cmd");
    expect(csv).toContain("'@SUM");
    expect(csv).toContain("\r\n-5.50\r\n");
    expect(csv).toContain("'-texto");
  });
});
