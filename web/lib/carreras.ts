export type CarreraId = "arquitectura" | "filosofia" | "bioquimica";

export type CarreraConfig = {
    id: CarreraId;
    nombre: string;
    descripcion: string;
    jsonFile: string;
    disponible?: boolean;
};

export const CARRERAS: CarreraConfig[] = [
    {
    id: "arquitectura",
    nombre: "Arquitectura",
    descripcion: "Plan de estudios y correlativas.",
    jsonFile: "arquitectura.json",
    disponible: true,
    },
    {
    id: "filosofia",
    nombre: "Filosofía",
    descripcion: "Plan de estudios y correlativas.",
    jsonFile: "filosofia.json",
    disponible: false,

    },
    {
    id: "bioquimica",
    nombre: "Bioquímica",
    descripcion: "Plan de estudios y correlativas.",
    jsonFile: "bioquimica.json",
    disponible: true,

    },
];

export function getCarreraById(id: string) {
    return CARRERAS.find((c) => c.id === id) ?? null;
}