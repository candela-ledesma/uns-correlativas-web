export type CarreraId = "arquitectura" | "lic_computacion" | "bioquimica" | "ing_civil";

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
    id: "lic_computacion",
    nombre: "Licenciatura en Ciencias de la Computación",
    descripcion: "Plan de estudios y correlativas.",
    jsonFile: "lic_computacion.json",
    disponible: true,

    },
    {
    id: "bioquimica",
    nombre: "Bioquímica",
    descripcion: "Plan de estudios y correlativas.",
    jsonFile: "bioquimica.json",
    disponible: true,

    },
    {
    id: "ing_civil",
    nombre: "Ingeniería Civil",
    descripcion: "Plan de estudios y correlativas.",
    jsonFile: "ing_civil.json",
    disponible: true,

    },
];

export function getCarreraById(id: string) {
    return CARRERAS.find((c) => c.id === id) ?? null;
}