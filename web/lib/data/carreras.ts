export type CarreraId = "arquitectura" | "lic_computacion" | "bioquimica" | "ing_civil" | "abogacia" | "agrimensura" | "farmacia" | "contador_publico";

export type CarreraVersionConfig = {
    versionId: string;
    label: string;
    jsonFile: string;
    disponible?: boolean;
    hidden?: boolean;
};

export type CarreraConfig = {
    id: CarreraId;
    nombre: string;
    descripcion: string;
    departamento?: string;
    defaultVersionId: string;
    versions: CarreraVersionConfig[];
    disponible?: boolean;
};

const includeInternalVersions = process.env.NODE_ENV !== "production";

export const CARRERAS: CarreraConfig[] = [
    {
    id: "arquitectura",
    nombre: "Arquitectura",
    descripcion: "Plan de estudios y correlativas.",
    departamento: "Geografía y Turismo",
    defaultVersionId: "v2",
    versions: [
        {
        versionId: "v2",
        label: "Plan actual",
        jsonFile: "arquitectura.json",
        disponible: true,
        },
        ...(includeInternalVersions
        ? [
            {
            versionId: "v2_interna",
            label: "Plan alternativo interno",
            jsonFile: "arquitectura.json",
            disponible: true,
            hidden: true,
            },
            {
            versionId: "v_invalid_shape",
            label: "Plan con formato inválido (test)",
            jsonFile: "arquitectura_invalid_shape.json",
            disponible: true,
            hidden: true,
            },
        ]
        : []),
    ],
    disponible: true,
    },
    {
    id: "lic_computacion",
    nombre: "Licenciatura en Ciencias de la Computación",
    descripcion: "Plan de estudios y correlativas.",
    departamento: "Ciencias e Ingeniería de la Computación",
    defaultVersionId: "v1",
    versions: [
        {
        versionId: "v1",
        label: "Plan actual",
        jsonFile: "lic_computacion.json",
        disponible: true,
        },
    ],
    disponible: true,

    },
    {
    id: "bioquimica",
    nombre: "Bioquímica",
    descripcion: "Plan de estudios y correlativas.",
    departamento: "Biología, Bioquímica y Farmacia",
    defaultVersionId: "v1",
    versions: [
        {
        versionId: "v1",
        label: "Plan actual",
        jsonFile: "bioquimica.json",
        disponible: true,
        },
    ],
    disponible: true,

    },
    {
    id: "ing_civil",
    nombre: "Ingeniería Civil",
    descripcion: "Plan de estudios y correlativas.",
    departamento: "Ingeniería",
    defaultVersionId: "v1",
    versions: [
        {
        versionId: "v1",
        label: "Plan actual",
        jsonFile: "ing_civil.json",
        disponible: true,
        },
    ],
    disponible: true,

    },
    {
    id: "abogacia",
    nombre: "Abogacía",
    descripcion: "Plan de estudios y correlativas.",
    departamento: "Derecho",
    defaultVersionId: "v1",
    versions: [
        {
        versionId: "v1",
        label: "Plan actual",
        jsonFile: "abogacia.json",
        disponible: true,
        },
    ],
    disponible: true,
    },
    {
    id: "agrimensura",
    nombre: "Agrimensura",
    descripcion: "Plan de estudios y correlativas.",
    departamento: "Ingeniería",
    defaultVersionId: "v1",
    versions: [
        {
        versionId: "v1",
        label: "Plan actual",
        jsonFile: "agrimensura.json",
        disponible: true,
        },
    ],
    disponible: true,
    },
    {
    id: "farmacia",
    nombre: "Farmacia",
    descripcion: "Plan de estudios y correlativas.",
    departamento: "Biología, Bioquímica y Farmacia",
    defaultVersionId: "v1",
    versions: [
        {
        versionId: "v1",
        label: "Plan actual",
        jsonFile: "farmacia.json",
        disponible: true,
        },
    ],
    disponible: true,
    },
    {
    id: "contador_publico",
    nombre: "Contador Público",
    descripcion: "Plan de estudios y correlativas.",
    departamento: "Ciencias de la Administración",
    defaultVersionId: "v1",
    versions: [
        {
        versionId: "v1",
        label: "Plan actual",
        jsonFile: "contador_publico.json",
        disponible: true,
        },
    ],
    disponible: true,
    },

    {
    id: "ingenieria_en_sistemas_de_informacion" as unknown as CarreraId,
    nombre: "Ingeniería en Sistemas de Información",
    descripcion: "Plan de estudios y correlativas.",
    departamento: "Ciencias e Ingeniería de la Computación",
    defaultVersionId: "v1",
    versions: [
        {
        versionId: "v1",
        label: "Plan actual",
        jsonFile: "ingenieria_en_sistemas_de_informacion.json",
        disponible: true,
        },
    ],
    disponible: true,
    },
];

export function getCarreraById(id: string) {
    return CARRERAS.find((c) => c.id === id) ?? null;
}

export function getDefaultVersionForCarrera(carreraId: string): CarreraVersionConfig | null {
    const carrera = getCarreraById(carreraId);
    if (!carrera) return null;

    return (
    carrera.versions.find((v) => v.versionId === carrera.defaultVersionId) ?? null
    );
}

export function getVersionForCarrera(
    carreraId: string,
    versionId: string | null
): CarreraVersionConfig | null {
    const carrera = getCarreraById(carreraId);
    if (!carrera) return null;

    const resolvedVersionId = versionId ?? carrera.defaultVersionId;
    return carrera.versions.find((v) => v.versionId === resolvedVersionId) ?? null;
}
