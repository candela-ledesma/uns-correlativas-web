-- Crear tabla Departamento
CREATE TABLE "Departamento" (
  "id"     TEXT NOT NULL,
  "nombre" TEXT NOT NULL,
  CONSTRAINT "Departamento_pkey" PRIMARY KEY ("id")
);

-- Seed inicial de departamentos desde los valores actuales en Carrera
INSERT INTO "Departamento" ("id", "nombre") VALUES
  ('agronomia',                      'Agronomía'),
  ('biologia_bioquimica_farmacia',   'Biología, Bioquímica y Farmacia'),
  ('ciencias_administracion',        'Ciencias de la Administración'),
  ('ciencias_ingenieria_computacion','Ciencias e Ingeniería de la Computación'),
  ('derecho',                        'Derecho'),
  ('economia',                       'Economía'),
  ('geografia_turismo',              'Geografía y Turismo'),
  ('humanidades',                    'Humanidades'),
  ('ingenieria',                     'Ingeniería'),
  ('ingenieria_electrica_computadoras','Ingeniería Eléctrica y de Computadoras')
ON CONFLICT DO NOTHING;

-- Agregar columna departamentoId a Carrera
ALTER TABLE "Carrera" ADD COLUMN "departamentoId" TEXT;

-- Migrar datos: mapear el string libre al slug del departamento
UPDATE "Carrera" SET "departamentoId" = 'agronomia'                       WHERE "departamento" = 'Agronomía';
UPDATE "Carrera" SET "departamentoId" = 'biologia_bioquimica_farmacia'    WHERE "departamento" = 'Biología, Bioquímica y Farmacia';
UPDATE "Carrera" SET "departamentoId" = 'ciencias_administracion'         WHERE "departamento" = 'Ciencias de la Administración';
UPDATE "Carrera" SET "departamentoId" = 'ciencias_ingenieria_computacion' WHERE "departamento" = 'Ciencias e Ingeniería de la Computación';
UPDATE "Carrera" SET "departamentoId" = 'derecho'                         WHERE "departamento" = 'Derecho';
UPDATE "Carrera" SET "departamentoId" = 'economia'                        WHERE "departamento" = 'Economía';
UPDATE "Carrera" SET "departamentoId" = 'geografia_turismo'               WHERE "departamento" = 'Geografía y Turismo';
UPDATE "Carrera" SET "departamentoId" = 'humanidades'                     WHERE "departamento" = 'Humanidades';
UPDATE "Carrera" SET "departamentoId" = 'ingenieria'                      WHERE "departamento" = 'Ingeniería';
UPDATE "Carrera" SET "departamentoId" = 'ingenieria_electrica_computadoras' WHERE "departamento" = 'Ingeniería Eléctrica y de Computadoras';

-- Agregar FK
ALTER TABLE "Carrera" ADD CONSTRAINT "Carrera_departamentoId_fkey"
  FOREIGN KEY ("departamentoId") REFERENCES "Departamento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Índice
CREATE INDEX IF NOT EXISTS "Carrera_departamentoId_idx" ON "Carrera"("departamentoId");

-- Eliminar columna string libre
ALTER TABLE "Carrera" DROP COLUMN "departamento";
