export type ScheduleBlockData = {
  id?: string;
  dia: number;       // 1=Lunes … 5=Viernes
  horaInicio: number; // minutes from midnight
  horaFin: number;    // minutes from midnight
};

export function blocksOverlap(a: ScheduleBlockData, b: ScheduleBlockData): boolean {
  return a.dia === b.dia && a.horaInicio < b.horaFin && a.horaFin > b.horaInicio;
}

export function findOverlaps(
  newBlock: ScheduleBlockData,
  existingBlocks: ScheduleBlockData[],
): ScheduleBlockData[] {
  return existingBlocks.filter(
    (b) => b.id !== newBlock.id && blocksOverlap(newBlock, b),
  );
}

export function validateScheduleBlock(block: ScheduleBlockData): string | null {
  if (!Number.isInteger(block.dia) || block.dia < 1 || block.dia > 5) {
    return "El día debe ser entre 1 (Lunes) y 5 (Viernes)";
  }
  if (!Number.isInteger(block.horaInicio) || block.horaInicio < 0 || block.horaInicio >= 1440) {
    return "Hora de inicio inválida";
  }
  if (!Number.isInteger(block.horaFin) || block.horaFin <= block.horaInicio) {
    return "La hora de fin debe ser posterior a la de inicio";
  }
  if (block.horaFin > 1440) {
    return "Hora de fin inválida";
  }
  return null;
}

export function minutesToTimeString(minutes: number): string {
  const h = Math.floor(minutes / 60).toString().padStart(2, "0");
  const m = (minutes % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

export function timeStringToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + (m ?? 0);
}

export const DIAS_SEMANA = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"] as const;
export const HORA_INICIO_GRILLA = 8 * 60;  // 8:00
export const HORA_FIN_GRILLA = 22 * 60;    // 22:00
export const SLOT_MINUTOS = 30;
export const SLOT_PX = 40;
