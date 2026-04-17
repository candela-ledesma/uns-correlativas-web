# Web

Aplicacion Next.js para visualizar planes de estudio y correlativas.

## Comandos principales

```bash
npm run dev
npm run build
npm run start
npm run lint
npm test -- --run
npm run test:e2e
```

## Validacion de datos (Incremento 4)

El proyecto incluye un validador batch para todos los JSON de `data/` configurados en el manifest de carreras.

### Scripts

```bash
# reporte human-readable
npm run validate:data

# reporte machine-readable por stdout
npm run validate:data:json

# modo estricto (warnings tambien fallan)
npm run validate:data:strict

# flujo sugerido para pre-merge local
npm run check:premerge
```

### CLI avanzada

```bash
npm run validate:data -- --format=both --json-out=./tmp/data-validation.json
npm run validate:data -- --strict --include-hidden
npm run validate:data -- --data-dir=./data
```

Opciones disponibles:

- `--strict`: trata warnings como fallo.
- `--include-hidden`: incluye versiones ocultas del manifest.
- `--include-unavailable`: incluye versiones marcadas no disponibles.
- `--format=human|json|both`: formato de salida.
- `--json-out=<ruta>`: escribe reporte JSON a archivo.
- `--data-dir=<ruta>`: directorio de datos alternativo.

## Politica de severidades

- `critical` (bloqueante): shape invalido, IDs duplicados, referencias esenciales rotas.
- `medium` (warning): inconsistencias toleradas de legado o referencias cruzadas no bloqueantes.
- `low` (warning): calidad de datos no critica (por ejemplo carga horaria vacia).

Regla de exit code:

- Falla (`exit 1`) si hay issues `critical`.
- En modo `--strict`, tambien falla si hay `medium` o `low`.

## Reporte

El reporte incluye:

- resumen global por severidad
- conteo por tipo de issue
- detalle por carrera/version
- estado final (`PASS` o `FAIL`)
