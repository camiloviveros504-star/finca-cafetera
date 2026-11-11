import { describe, expect, it } from "vitest";
import { aEscala } from "@/shared/dominio/decimal";
import { calcularValor, convertirAUnidadDeModalidad, repartirAnticipos, sumar } from "@/modules/talento/domain/calculos";

describe("cálculo de remuneración (aritmética exacta)", () => {
  it("80 kg × 1.500 = 120.000 (ejemplo del prompt)", () => {
    expect(calcularValor("80", "1500")).toBe("120000.00");
  });

  it("no acumula errores de coma flotante", () => {
    expect(calcularValor("0.1", "3")).toBe("0.30");
    expect(calcularValor("33.333", "1500")).toBe("49999.50");
  });

  it("convierte kg a arrobas con el factor configurado y no con una constante", () => {
    const factor = aEscala("12.5", 6);
    expect(convertirAUnidadDeModalidad(aEscala("25", 3), "kg", "arroba", factor)).toBe(aEscala("2", 3));
    expect(convertirAUnidadDeModalidad(aEscala("2", 3), "arroba", "kg", factor)).toBe(aEscala("25", 3));
    // Otro factor (p. ej. una finca con otra equivalencia) cambia el resultado.
    expect(convertirAUnidadDeModalidad(aEscala("25", 3), "kg", "arroba", aEscala("25", 6))).toBe(aEscala("1", 3));
  });

  it("rechaza unidades que no corresponden a la modalidad", () => {
    expect(() => convertirAUnidadDeModalidad(aEscala("1", 3), "kg", "jornada", null)).toThrow(/no corresponde/);
  });

  it("reparte anticipos del más antiguo al más reciente sin superar el tope", () => {
    const reparto = repartirAnticipos([{ id: "a", saldo: "50000.00" }, { id: "b", saldo: "70000.00" }], "80000.00");
    expect(reparto).toEqual([{ anticipoId: "a", monto: "50000.00" }, { anticipoId: "b", monto: "30000.00" }]);
    expect(sumar(reparto.map((r) => r.monto))).toBe("80000.00");
  });
});
