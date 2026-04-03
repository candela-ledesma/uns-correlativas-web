export type CarreraId = "arquitectura" | "filosofia" | "bioquimica";

export type CarreraConfig = {
    id: CarreraId;
    nombre: string;
    descripcion: string;
    jsonFile: string;
};

export const CARRERAS: CarreraConfig[] = [
    {
    id: "arquitectura",
    nombre: "Arquitectura",
    descripcion: "Plan de estudios y correlativas.",
    jsonFile: "arquitectura.json",
    },
    {
    id: "filosofia",
    nombre: "Filosofía",
    descripcion: "Plan de estudios y correlativas.",
    jsonFile: "filosofia.json",
    },
    {
    id: "bioquimica",
    nombre: "Bioquímica",
    descripcion: "Plan de estudios y correlativas.",
    jsonFile: "bioquimica.json",
    },
];

export function getCarreraById(id: string) {
    return CARRERAS.find((c) => c.id === id) ?? null;
}