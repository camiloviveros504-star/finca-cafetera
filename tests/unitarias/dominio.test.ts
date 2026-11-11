import { describe, expect, it } from "vitest";
import { aEscala, aplicarFactor, deEscala, multiplicarCantidadPorPrecio } from "@/shared/dominio/decimal";
import { asignarExistencias } from "@/modules/inventario/domain/asignacion";

describe("aritmética decimal exacta", () => {
  it("convierte sin pérdida y sin float", () => {
    expect(aEscala("12.5", 3)).toBe(12500n);
    expect(deEscala(12500n, 3)).toBe("12.500");
    expect(deEscala(-1500n, 3)).toBe("-1.500");
    expect(aEscala("0.1", 3) + aEscala("0.2", 3)).toBe(aEscala("0.3", 3));
  });

  it("multiplica cantidad por precio con redondeo half-up (80 kg × $1.500 = $120.000)", () => {
    expect(deEscala(multiplicarCantidadPorPrecio(aEscala("80", 3), aEscala("1500", 2)), 2)).toBe("120000.00");
    expect(deEscala(multiplicarCantidadPorPrecio(aEscala("0.333", 3), aEscala("10.00", 2)), 2)).toBe("3.33");
  });

  it("aplica un factor de conversión (1 arroba = 12,5 kg)", () => {
    expect(deEscala(aplicarFactor(aEscala("4", 3), aEscala("12.5", 6)), 3)).toBe("50.000");
  });

  it("rechaza texto que no es un número", () => {
    expect(() => aEscala("abc", 3)).toThrow();
  });
});

describe("asignación de existencias", () => {
  const saldos = [
    { id: "a", loteId: "L1", bodegaId: "B", cantidad: 60000n },
    { id: "b", loteId: "L2", bodegaId: "B", cantidad: 40000n },
  ];

  it("toma del primer saldo si alcanza", () => {
    const r = asignarExistencias(saldos, 50000n);
    expect(r.alcanza).toBe(true);
    expect(r.asignaciones).toEqual([{ saldoId: "a", loteId: "L1", bodegaId: "B", cantidad: 50000n }]);
  });

  it("reparte entre lotes cuando hace falta", () => {
    const r = asignarExistencias(saldos, 80000n);
    expect(r.asignaciones.map((a) => a.cantidad)).toEqual([60000n, 20000n]);
  });

  it("rechaza si no alcanza e informa lo disponible", () => {
    const r = asignarExistencias(saldos, 100001n);
    expect(r.alcanza).toBe(false);
    expect(r.disponible).toBe(100000n);
    expect(r.asignaciones).toEqual([]);
  });

  it("rechaza cantidades no positivas", () => {
    expect(asignarExistencias(saldos, 0n).alcanza).toBe(false);
  });
});
