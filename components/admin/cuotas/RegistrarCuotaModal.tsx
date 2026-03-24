"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  X,
  AlertCircle,
  CheckCircle,
  Loader2,
  Search,
  User,
  BookOpen,
  CreditCard,
  DollarSign,
  CalendarDays,
  ChevronRight,
  AlertTriangle,
  Pencil,
  RotateCcw,
  Tag,
  MessageSquare,
  SplitSquareHorizontal, // NUEVO
  Plus, // NUEVO
  Trash2, // NUEVO
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import {
  collection,
  getDocs,
  query,
  where,
  updateDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebaseConfig";
import {
  type Cuota,
  type Descuento,
  calcularPrecioBase,
  aplicarDescuentos,
} from "@/lib/cuotas";

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface CuotaDoc extends Cuota {
  estado: "Pendiente" | "Pagado" | "Incobrable";
}

interface AlumnoInfo {
  id: string;
  nombre: string;
  tipo: "adulto" | "menor";
  dni: string;
  cursos: Record<string, string>;
}

interface RegistrarPagoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  preloadedDni?: string;
}

// ─── Lógica de Máximo Beneficio ──────────────────────────────────────────────

function obtenerMejorDescuento(descuentos?: Descuento[]): Descuento | null {
  if (!descuentos || descuentos.length === 0) return null;
  return descuentos.reduce((max, obj) =>
    obj.porcentaje > max.porcentaje ? obj : max,
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const MESES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

function formatMes(mes: number, anio: number): string {
  return `${MESES[mes - 1]} ${anio}`;
}

function resolverMontoCobro(cuota: CuotaDoc): number {
  const base = calcularPrecioBase(cuota);
  const mejorDescuento = obtenerMejorDescuento(cuota.descuentos);
  return aplicarDescuentos(base, mejorDescuento ? [mejorDescuento] : []);
}

function resolverTextoCobro(cuota: CuotaDoc): string {
  if (cuota.esPrimerMes) return "Monto de primer mes";
  const hoy = new Date();
  const mesHoy = hoy.getMonth() + 1;
  const anioHoy = hoy.getFullYear();
  const esMesFuturo =
    cuota.anio > anioHoy || (cuota.anio === anioHoy && cuota.mes > mesHoy);
  if (esMesFuturo) return "Cobro del 1 al 10 (mes futuro)";
  return hoy.getDate() <= 10 ? "Cobro del 1 al 10" : "Cobro del 11 en adelante";
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function sortCuotasAsc(cuotas: CuotaDoc[]): CuotaDoc[] {
  return [...cuotas].sort((a, b) =>
    a.anio !== b.anio ? a.anio - b.anio : a.mes - b.mes,
  );
}

function mapDocToCuota(d: {
  id: string;
  data: () => Record<string, unknown>;
}): CuotaDoc {
  const data = d.data();
  return {
    id: d.id,
    alumnoId: data.alumnoId as string,
    alumnoTipo: data.alumnoTipo as "adulto" | "menor",
    alumnoNombre: data.alumnoNombre as string,
    alumnoDni: data.alumnoDni as string,
    cursoId: data.cursoId as string,
    cursoNombre: data.cursoNombre as string,
    mes: data.mes as number,
    anio: data.anio as number,
    cuota1a10: (data.cuota1a10 as number) ?? 0,
    cuota11enAdelante: (data.cuota11enAdelante as number) ?? 0,
    esPrimerMes: (data.esPrimerMes as boolean) ?? false,
    montoPrimerMes: (data.montoPrimerMes as number | null) ?? null,
    estado:
      (data.estado as "Pendiente" | "Pagado" | "Incobrable") ?? "Pendiente",
    montoPagado: (data.montoPagado as number | null) ?? null,
    metodoPago: (data.metodoPago as string | null) ?? null,
    inscripcionId: (data.inscripcionId as string) ?? "",
    fechaPago: (data.fechaPago as string | null) ?? null,
    descuentos: (data.descuentos as Descuento[]) ?? [],
  };
}

// ─── Componente ───────────────────────────────────────────────────────────────

export default function RegistrarCuotaModal({
  isOpen,
  onClose,
  onSuccess,
  preloadedDni,
}: RegistrarPagoModalProps) {
  const [dniSearch, setDniSearch] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [alumnoInfo, setAlumnoInfo] = useState<AlumnoInfo | null>(null);
  const [todasCuotasPendientes, setTodasCuotasPendientes] = useState<
    CuotaDoc[]
  >([]);
  const [selectedCursoId, setSelectedCursoId] = useState("");

  const cuotasPendientesCurso = sortCuotasAsc(
    todasCuotasPendientes.filter((c) => c.cursoId === selectedCursoId),
  );
  const cuotaACobrar = cuotasPendientesCurso[0] ?? null;
  const cuotasEnDeuda = cuotasPendientesCurso.slice(1);

  // Monto del sistema (base + descuento automático MÁXIMO)
  const montoSistema = cuotaACobrar ? resolverMontoCobro(cuotaACobrar) : 0;

  // ── Estado del ajuste manual ──────────────────────────────────────────────
  const [editandoMonto, setEditandoMonto] = useState(false);
  const [montoEditado, setMontoEditado] = useState<string>("");
  const [motivoAjuste, setMotivoAjuste] = useState<string>("");
  const inputMontoRef = useRef<HTMLInputElement>(null);

  const montoEditadoNum = parseFloat(montoEditado);
  const ajusteAplicado =
    montoEditado !== "" &&
    !isNaN(montoEditadoNum) &&
    montoEditadoNum > 0 &&
    montoEditadoNum !== montoSistema;

  const diferenciaAjuste = ajusteAplicado ? montoEditadoNum - montoSistema : 0;
  
  // Monto final a cobrar (sea el del sistema o el ajustado manual)
  const montoMostrar = ajusteAplicado ? montoEditadoNum : montoSistema;

  // ── LÓGICA DE PAGOS MÚLTIPLES (Split Payment) ───────────────────────────
  const [paymentMethod, setPaymentMethod] = useState("");
  const [isSplitPayment, setIsSplitPayment] = useState(false);
  const [partialPayments, setPartialPayments] = useState<{ method: string; amount: number }[]>([
    { method: "", amount: 0 },
  ]);

  const totalIngresado = partialPayments.reduce((acc, curr) => acc + (curr.amount || 0), 0);
  const saldoRestante = montoMostrar - totalIngresado;

  // Efecto Concatenador para Split Payment
  useEffect(() => {
    if (isSplitPayment) {
      const allMethodsSelected = partialPayments.every((p) => p.method !== "");
      
      // La matemática tiene que cuadrar exacto para armar el String
      if (totalIngresado === montoMostrar && allMethodsSelected && partialPayments.length > 0) {
        const stringFormateado = partialPayments
          .map((p) => `${p.method} ($${p.amount.toLocaleString("es-AR")})`)
          .join(" + ");
        setPaymentMethod(stringFormateado);
      } else {
        setPaymentMethod(""); // Bloquea el submit
      }
    }
  }, [partialPayments, isSplitPayment, montoMostrar, totalIngresado]);

  const addPartialPayment = () => {
    setPartialPayments([...partialPayments, { method: "", amount: saldoRestante > 0 ? saldoRestante : 0 }]);
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updatePartialPayment = (index: number, field: "method" | "amount", value: any) => {
    const newPayments = [...partialPayments];
    newPayments[index] = { ...newPayments[index], [field]: value };
    setPartialPayments(newPayments);
  };

  const removePartialPayment = (index: number) => {
    const newPayments = partialPayments.filter((_, i) => i !== index);
    setPartialPayments(newPayments);
  };
  // ─────────────────────────────────────────────────────────────────────────

  const [allowException, setAllowException] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isFutureMonthWarning = (() => {
    if (!cuotaACobrar) return false;
    const hoy = new Date();
    const mesHoy = hoy.getMonth() + 1;
    const anioHoy = hoy.getFullYear();
    return (
      cuotaACobrar.anio > anioHoy ||
      (cuotaACobrar.anio === anioHoy && cuotaACobrar.mes > mesHoy)
    );
  })();

  useEffect(() => {
    if (editandoMonto && inputMontoRef.current) {
      inputMontoRef.current.focus();
      inputMontoRef.current.select();
    }
  }, [editandoMonto]);

  useEffect(() => {
    if (!isOpen) return;
    setAlumnoInfo(null);
    setTodasCuotasPendientes([]);
    setSelectedCursoId("");
    setPaymentMethod("");
    setIsSplitPayment(false);
    setPartialPayments([{ method: "", amount: 0 }]);
    setAllowException(false);
    setErrorMsg(null);
    setEditandoMonto(false);
    setMontoEditado("");
    setMotivoAjuste("");
    if (preloadedDni) {
      setDniSearch(preloadedDni);
      searchByDni(preloadedDni);
    } else {
      setDniSearch("");
    }
  }, [isOpen, preloadedDni]);

  useEffect(() => {
    setAllowException(false);
    setEditandoMonto(false);
    setMontoEditado("");
    setMotivoAjuste("");
    setPaymentMethod("");
    setIsSplitPayment(false);
    setPartialPayments([{ method: "", amount: 0 }]);
  }, [cuotaACobrar?.id]);

  const searchByDni = async (dni: string) => {
    setIsSearching(true);
    setErrorMsg(null);
    setAlumnoInfo(null);
    setTodasCuotasPendientes([]);
    setSelectedCursoId("");

    try {
      const snapTodas = await getDocs(
        query(collection(db, "Cuotas"), where("alumnoDni", "==", dni)),
      );
      if (snapTodas.empty) {
        setErrorMsg("No se encontró ningún alumno con ese DNI en el sistema de cuotas.");
        return;
      }
      const primerDoc = snapTodas.docs[0].data();
      const cursosMap: Record<string, string> = {};
      snapTodas.docs.forEach((d) => {
        const data = d.data();
        if (data.cursoId && data.cursoNombre)
          cursosMap[data.cursoId] = data.cursoNombre;
      });
      setAlumnoInfo({
        id: primerDoc.alumnoId,
        nombre: primerDoc.alumnoNombre,
        tipo: primerDoc.alumnoTipo,
        dni: primerDoc.alumnoDni,
        cursos: cursosMap,
      });
      const pendientes = snapTodas.docs
        .filter((d) => d.data().estado === "Pendiente")
        .map(mapDocToCuota);
      setTodasCuotasPendientes(pendientes);
      setSelectedCursoId(Object.keys(cursosMap)[0]);
    } catch (error) {
      console.error("Error al buscar alumno por DNI:", error);
      setErrorMsg("Error de conexión al buscar el DNI.");
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearchStudent = () => {
    if (!dniSearch.trim()) {
      setErrorMsg("Debes ingresar un DNI para buscar.");
      return;
    }
    searchByDni(dniSearch.trim());
  };

  const handleAplicarMonto = () => {
    const valor = parseFloat(montoEditado);
    if (isNaN(valor) || valor <= 0) {
      setErrorMsg("Ingresá un monto válido mayor a cero.");
      return;
    }
    if (!motivoAjuste.trim()) {
      setErrorMsg("Debés ingresar una aclaración para el ajuste de monto.");
      return;
    }
    setErrorMsg(null);
    setEditandoMonto(false);
    
    // Si aplican un ajuste manual y estaban en medio de un Split Payment, re-calculamos
    if (isSplitPayment) {
      setPartialPayments([{ method: "", amount: valor }]);
      setPaymentMethod("");
    }
  };

  const handleCancelarEdicion = () => {
    setMontoEditado("");
    setMotivoAjuste("");
    setEditandoMonto(false);
    if (isSplitPayment) {
      setPartialPayments([{ method: "", amount: montoSistema }]);
      setPaymentMethod("");
    }
  };

  const handleRegistrarPago = async () => {
    if (!paymentMethod) {
      setErrorMsg(isSplitPayment ? "Los montos de los métodos de pago no coinciden con el total." : "Por favor, seleccioná un método de pago.");
      return;
    }
    if (!cuotaACobrar) return;
    if (ajusteAplicado && !motivoAjuste.trim()) {
      setErrorMsg("Falta la aclaración del ajuste de monto.");
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);

    try {
      const hoy = new Date();
      await updateDoc(doc(db, "Cuotas", cuotaACobrar.id), {
        estado: "Pagado",
        fechaPago: hoy.toLocaleDateString("es-AR"),
        metodoPago: paymentMethod, // Pasamos el string concatenado
        montoPagado: montoMostrar,
        ...(ajusteAplicado && {
          montoAjustado: montoMostrar,
          motivoAjuste: motivoAjuste.trim(),
        }),
        actualizadoEn: serverTimestamp(),
      });
      onSuccess();
      onClose();
    } catch (error) {
      console.error("Error al registrar el pago:", error);
      setErrorMsg("Ocurrió un error en el servidor al procesar el pago.");
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const cursosIds = alumnoInfo ? Object.keys(alumnoInfo.cursos) : [];

  // 🚀 Obtenemos el único descuento ganador para la UI
  const mejorDescuento = cuotaACobrar ? obtenerMejorDescuento(cuotaACobrar.descuentos) : null;
  const tieneDescuentos = !!mejorDescuento;
  const precioBaseOriginal = cuotaACobrar ? calcularPrecioBase(cuotaACobrar) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-100 bg-gray-50/50 shrink-0">
          <h2 className="text-xl font-bold text-[#252d62]">Registrar Pago</h2>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto">
          {/* Búsqueda por DNI */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-700">
              Buscar Alumno por DNI
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={dniSearch}
                  onChange={(e) => setDniSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearchStudent()}
                  placeholder="Ej: 38123456"
                  className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#252d62]/20"
                />
              </div>
              <Button
                onClick={handleSearchStudent}
                disabled={isSearching || !dniSearch.trim()}
                className="bg-[#252d62] hover:bg-[#1a2046] text-white rounded-xl"
              >
                {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : "Buscar"}
              </Button>
            </div>
          </div>

          {alumnoInfo && (
            <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
              {/* Card alumno */}
              <div className="p-4 bg-blue-50/50 border border-blue-100 rounded-xl flex items-center gap-3">
                <div className="p-2 bg-blue-100 text-blue-700 rounded-full">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-bold text-[#252d62]">
                    {alumnoInfo.nombre}
                  </p>
                  <p className="text-xs text-gray-500">
                    DNI: {alumnoInfo.dni} |{" "}
                    <span className="uppercase text-blue-600 font-semibold">
                      {alumnoInfo.tipo === "menor" ? "Alumno Menor" : "Alumno Mayor"}
                    </span>
                  </p>
                </div>
              </div>

              {/* Selector de curso */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <BookOpen className="w-4 h-4" /> Curso
                </label>
                {cursosIds.length > 1 ? (
                  <select
                    value={selectedCursoId}
                    onChange={(e) => {
                      setSelectedCursoId(e.target.value);
                      setPaymentMethod("");
                      setIsSplitPayment(false);
                      setPartialPayments([{ method: "", amount: 0 }]);
                      setMontoEditado("");
                      setMotivoAjuste("");
                      setEditandoMonto(false);
                    }}
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#252d62]/20 font-medium"
                  >
                    {cursosIds.map((id) => (
                      <option key={id} value={id}>
                        {alumnoInfo.cursos[id]}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-700 font-medium">
                    {alumnoInfo.cursos[selectedCursoId] || selectedCursoId}
                  </div>
                )}
              </div>

              {cuotasPendientesCurso.length === 0 ? (
                <div className="p-3 bg-green-50 border border-green-200 text-green-700 rounded-xl text-sm flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" />
                  Al día. Todas las cuotas pagadas para este curso.
                </div>
              ) : (
                <>
                  {/* Resumen de deuda */}
                  {cuotasEnDeuda.length > 0 && (
                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-3">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                        <div>
                          <p className="text-sm font-bold text-amber-800">
                            {cuotasPendientesCurso.length} cuotas existentes
                          </p>
                          <p className="text-xs text-amber-700 mt-0.5">
                            Se deben abonar en orden. No se puede saltar una
                            cuota sin pagar la anterior.
                          </p>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        {cuotasPendientesCurso.map((cuota, index) => (
                          <div
                            key={cuota.id}
                            className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm ${index === 0 ? "bg-amber-100 border border-amber-300 font-semibold text-amber-900" : "bg-white/60 border border-amber-200/50 text-amber-700 opacity-60"}`}
                          >
                            <div className="flex items-center gap-2">
                              <CalendarDays className="w-3.5 h-3.5 shrink-0" />
                              <span>{formatMes(cuota.mes, cuota.anio)}</span>
                              {index === 0 && (
                                <span className="text-[10px] font-bold bg-amber-500 text-white px-1.5 py-0.5 rounded">
                                  COBRAR AHORA
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1 text-xs">
                              {formatCurrency(resolverMontoCobro(cuota))}
                              {index > 0 && (
                                <ChevronRight className="w-3 h-3 opacity-50" />
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Cuota a abonar */}
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-gray-700">
                      Cuota a Abonar
                    </label>
                    <div className="px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl flex items-center gap-3">
                      <CalendarDays className="w-4 h-4 text-gray-400 shrink-0" />
                      <span className="text-sm font-semibold text-gray-700">
                        {formatMes(cuotaACobrar!.mes, cuotaACobrar!.anio)}
                      </span>
                      {cuotaACobrar!.esPrimerMes && (
                        <span className="text-[10px] font-bold bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded">
                          1er mes
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Advertencia mes futuro */}
                  {isFutureMonthWarning && (
                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-3">
                      <div className="flex items-start gap-2 text-amber-800">
                        <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                        <p className="text-sm font-medium">
                          Este mes está fuera del período habitual de cobro. No
                          se permite registrar pagos con tanta anticipación.
                        </p>
                      </div>
                      <label className="flex items-center gap-3 cursor-pointer select-none">
                        <div
                          onClick={() => setAllowException((v) => !v)}
                          className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${allowException ? "bg-amber-500 border-amber-500" : "border-amber-400 bg-white"}`}
                        >
                          {allowException && (
                            <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none">
                              <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                        </div>
                        <span className="text-sm font-semibold text-amber-800">
                          Permitir excepción para este pago
                        </span>
                      </label>
                    </div>
                  )}

                  {/* ── Monto a cobrar ──────────────────────────────────────── */}
                  <div className="space-y-2">
                    <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl space-y-3">
                      {/* Descuentos del sistema (Embudados) */}
                      {tieneDescuentos && mejorDescuento && (
                        <div className="space-y-2 pb-3 border-b border-gray-200">
                          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                            Descuento aplicado
                          </p>
                          <div className="flex items-center justify-between">
                            <span className="flex items-center gap-1.5 text-xs text-emerald-700 font-medium">
                              <Tag className="w-3 h-3" />
                              {mejorDescuento.detalle}
                            </span>
                            <span className="text-xs font-bold text-emerald-700">
                              −{mejorDescuento.porcentaje}%
                            </span>
                          </div>
                          <div className="flex justify-between text-xs pt-1">
                            <span className="text-gray-400 line-through">
                              {formatCurrency(precioBaseOriginal)}
                            </span>
                            <span className="text-emerald-600 font-bold">
                              {formatCurrency(montoSistema)}
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Fila principal: monto + botón ajustar */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="p-2 bg-green-100 rounded-lg shrink-0">
                            <DollarSign className="w-5 h-5 text-green-700" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-500">
                              Monto a Cobrar
                            </p>
                            <div className="flex items-center gap-2">
                              <p className={`text-lg font-bold ${ajusteAplicado ? "text-amber-600" : "text-[#252d62]"}`}>
                                {formatCurrency(montoMostrar)}
                              </p>
                              {ajusteAplicado && (
                                <span className="text-xs text-gray-400 line-through">
                                  {formatCurrency(montoSistema)}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {!editandoMonto ? (
                          <button
                            onClick={() => {
                              setMontoEditado(ajusteAplicado ? montoEditado : String(montoSistema));
                              setEditandoMonto(true);
                            }}
                            className="flex items-center gap-1.5 text-xs font-semibold text-[#252d62] hover:text-[#EE1120] border border-gray-200 hover:border-[#EE1120] px-2.5 py-1.5 rounded-lg transition-colors"
                          >
                            <Pencil className="w-3 h-3" />
                            {ajusteAplicado ? "Editar ajuste" : "Modificar monto"}
                          </button>
                        ) : (
                          <button
                            onClick={handleCancelarEdicion}
                            className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 hover:text-gray-600 border border-gray-200 px-2.5 py-1.5 rounded-lg transition-colors"
                          >
                            <RotateCcw className="w-3 h-3" />
                            Cancelar
                          </button>
                        )}
                      </div>

                      {/* Criterio base */}
                      {!editandoMonto && (
                        <p className="text-[11px] text-gray-400">
                          {resolverTextoCobro(cuotaACobrar!)}
                        </p>
                      )}

                      {/* Form de ajuste: nuevo monto + motivo */}
                      {editandoMonto && (
                        <div className="space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
                          <div className="space-y-1">
                            <p className="text-xs text-gray-500">
                              Monto del sistema:{" "}
                              <span className="font-semibold">
                                {formatCurrency(montoSistema)}
                              </span>
                              . Ingresá el nuevo monto:
                            </p>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-bold text-sm">$</span>
                              <input
                                ref={inputMontoRef}
                                type="number"
                                min={1}
                                value={montoEditado}
                                onChange={(e) => setMontoEditado(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && inputMontoRef.current?.blur()}
                                className="w-full pl-7 pr-3 py-2 border border-[#252d62] rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#252d62]/20"
                                placeholder={String(montoSistema)}
                              />
                            </div>
                          </div>

                          <div className="space-y-1">
                            <label className="flex items-center gap-1.5 text-xs font-bold text-gray-600">
                              <MessageSquare className="w-3.5 h-3.5" />
                              Motivo del ajuste <span className="text-red-500">*</span>
                            </label>
                            <textarea
                              value={motivoAjuste}
                              onChange={(e) => setMotivoAjuste(e.target.value)}
                              placeholder="Ej: Acuerdo de pago en cuotas, cortesía..."
                              rows={2}
                              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#252d62]/20 resize-none"
                            />
                          </div>

                          <Button
                            onClick={handleAplicarMonto}
                            className="w-full bg-[#252d62] hover:bg-[#1a2046] text-white rounded-lg text-sm"
                          >
                            Aplicar ajuste
                          </Button>
                        </div>
                      )}

                      {/* Badge de ajuste aplicado */}
                      {ajusteAplicado && !editandoMonto && (
                        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-amber-700 font-bold">
                              Monto ajustado{" "}
                              {diferenciaAjuste > 0
                                ? `+${formatCurrency(diferenciaAjuste)}`
                                : formatCurrency(diferenciaAjuste)}
                            </p>
                            <p className="text-[11px] text-amber-600 mt-0.5 truncate">
                              {motivoAjuste}
                            </p>
                          </div>
                          <button
                            onClick={() => {
                              setMontoEditado("");
                              setMotivoAjuste("");
                              setEditandoMonto(false);
                              if (isSplitPayment) {
                                setPartialPayments([{ method: "", amount: montoSistema }]);
                                setPaymentMethod("");
                              }
                            }}
                            className="text-amber-400 hover:text-amber-600 transition-colors shrink-0"
                            title="Quitar ajuste"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 🚀 Método de pago (CON SPLIT PAYMENT) */}
                  <div className="space-y-3">
                    <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                      <CreditCard className="w-4 h-4" /> Método de Pago
                    </label>
                    <select
                      value={isSplitPayment ? "multiple" : paymentMethod}
                      onChange={(e) => {
                        if (e.target.value === "multiple") {
                          setIsSplitPayment(true);
                          setPaymentMethod(""); // Reseteamos hasta que cuadre la matemática
                          setPartialPayments([{ method: "", amount: montoMostrar }]);
                        } else {
                          setIsSplitPayment(false);
                          setPaymentMethod(e.target.value);
                        }
                      }}
                      className="w-full px-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#252d62]/20 font-medium bg-white"
                    >
                      <option value="" disabled>-- Seleccione una opción --</option>
                      <option value="Efectivo">Efectivo</option>
                      <option value="Transferencia Bancaria (Verificada)">Transferencia Bancaria (Verificada)</option>
                      <option value="Tarjeta (Posnet)">Tarjeta (Posnet)</option>
                      <option value="multiple" className="font-bold text-blue-700">💳 Múltiples métodos (Ej: Efectivo + Transferencia)</option>
                    </select>

                    {/* UI de Split Payment */}
                    {isSplitPayment && (
                      <motion.div
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="p-4 border border-blue-200 bg-blue-50/30 rounded-xl space-y-3"
                      >
                        <div className="flex justify-between items-center pb-2 border-b border-blue-100">
                          <span className="text-xs font-bold text-[#252d62] uppercase tracking-wider flex items-center gap-1.5">
                            <SplitSquareHorizontal className="w-3.5 h-3.5" /> Desglose de pagos
                          </span>
                          <span
                            className={`text-sm font-bold ${
                              saldoRestante === 0
                                ? "text-emerald-600"
                                : saldoRestante < 0
                                  ? "text-red-600"
                                  : "text-amber-600"
                            }`}
                          >
                            Restante: ${saldoRestante.toLocaleString("es-AR")}
                          </span>
                        </div>

                        {partialPayments.map((p, index) => (
                          <div key={index} className="flex gap-2 items-center">
                            <select
                              value={p.method}
                              onChange={(e) => updatePartialPayment(index, "method", e.target.value)}
                              className="flex-1 py-2 px-2 border border-gray-200 rounded-lg text-xs bg-white focus:ring-1 focus:ring-blue-500 outline-none"
                            >
                              <option value="">Método...</option>
                              <option value="Efectivo">Efectivo</option>
                              <option value="Transferencia">Transferencia</option>
                              <option value="Tarjeta">Tarjeta</option>
                            </select>
                            
                            <div className="relative w-1/3">
                              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500 font-bold text-xs">$</span>
                              <input
                                type="number"
                                min={0}
                                value={p.amount === 0 ? "" : p.amount}
                                onChange={(e) => updatePartialPayment(index, "amount", Number(e.target.value))}
                                className="w-full pl-6 pr-2 py-2 border border-gray-200 rounded-lg text-xs bg-white focus:ring-1 focus:ring-blue-500 outline-none"
                                placeholder="0"
                              />
                            </div>

                            {partialPayments.length > 1 ? (
                              <button
                                type="button"
                                onClick={() => removePartialPayment(index)}
                                className="p-2 text-red-400 hover:text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            ) : (
                              <div className="w-[34px]" /> 
                            )}
                          </div>
                        ))}

                        {saldoRestante > 0 && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={addPartialPayment}
                            className="w-full mt-2 border-dashed border-blue-300 text-blue-700 hover:bg-blue-100 hover:border-blue-400"
                          >
                            <Plus className="w-3.5 h-3.5 mr-1.5" /> Agregar otro pago por ${saldoRestante.toLocaleString("es-AR")}
                          </Button>
                        )}
                        
                        {saldoRestante < 0 && (
                          <p className="text-[10px] text-red-500 font-medium text-center">
                            Los montos superan el total a cobrar. Ajuste los valores.
                          </p>
                        )}
                      </motion.div>
                    )}
                  </div>

                </>
              )}
            </div>
          )}
        </div>

        {/* Error */}
        {errorMsg && (
          <div className="mx-6 mb-2 flex items-start gap-3 p-3 bg-red-50 text-red-700 rounded-lg text-sm border border-red-100">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <p className="font-medium">{errorMsg}</p>
          </div>
        )}

        {/* Footer */}
        <div className="p-6 border-t border-gray-100 bg-gray-50/50 flex justify-end gap-3 shrink-0">
          <Button
            variant="outline"
            onClick={onClose}
            className="rounded-xl"
            disabled={isLoading}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleRegistrarPago}
            disabled={
              isLoading ||
              !cuotaACobrar ||
              !paymentMethod || // Se bloquea automático si la matemática del Split falla
              isSearching ||
              editandoMonto ||
              (isFutureMonthWarning && !allowException)
            }
            className="bg-[#252d62] hover:bg-[#1a2046] text-white rounded-xl flex items-center gap-2"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <CheckCircle className="w-4 h-4" />
            )}
            {isLoading ? "Procesando..." : "Confirmar Pago"}
          </Button>
        </div>
      </div>
    </div>
  );
}