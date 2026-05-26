# Índice general

- Agradecimientos iii
- Resumen iv
- Abstract v
- Índice de figuras viii
- Índice de cuadros ix
- 1 Introducción 1
  - 1.1 Motivación
  - 1.2 Problema y Desafíos
  - 1.3 Objetivo General
  - 1.4 Objetivos Específicos
  - 1.5 Organización del documento
- 2 Contexto y Tecnologías
  - 2.1 Contexto
  - 2.2 Herramientas y Tecnologías
    - 2.2.1 [Tecnología 1]
    - 2.2.2 [Tecnología 2]
    - 2.2.3 [Tecnología 3]
  - 2.3 Comparación de alternativas
- 3 Arquitectura de la Solución
  - 3.1 Descripción general
  - 3.2 Diagrama de arquitectura
  - 3.3 Modelo de datos
    - 3.3.1 Entidades principales
    - 3.3.2 Relaciones principales
    - 3.3.3 Decisiones de diseño relevantes
    - 3.3.4 Progreso del usuario como documento serializado
  - 3.4 Decisiones de diseño
- 4 Implementación
  - 4.1 Estructura del proyecto
  - 4.2 Módulo: [Nombre del módulo 1]
  - 4.3 Módulo: [Nombre del módulo 2]
  - 4.4 Módulo: [Nombre del módulo 3]
  - 4.5 Integración y flujo general
- 5 Evaluación y Resultados
  - 5.1 Metodología de evaluación
  - 5.2 Resultados obtenidos
  - 5.3 Discusión
- 6 Conclusión
  - 6.1 Aportes del trabajo
  - 6.2 Lecciones aprendidas
  - 6.3 Trabajo futuro
- Bibliografía
- A Manual de instalación
- B Glosario

---

## 3.3. Modelo de datos

El sistema utiliza PostgreSQL como base de datos relacional, accedida a través de Prisma ORM. El schema está diseñado alrededor de tres ejes: autenticación y perfil de usuario, gestión del ciclo de vida de los planes de estudio, y trazabilidad de acciones administrativas.

### Entidades principales

**User**
Representa a un usuario autenticado. Se crea automáticamente al primer login con Google (vía NextAuth). El campo `role` controla el nivel de acceso: `USER` solo accede a la aplicación, `MODERATOR` puede enviar planes para revisión, `ADMIN` puede publicar planes, gestionar usuarios y editar la configuración del sistema.

**Carrera / Departamento**
`Carrera` es la entidad central del dominio académico: cada carrera tiene un identificador slug (ej: `ingenieria_civil`), pertenece a un `Departamento`, y puede tener múltiples versiones de plan (`CarreraVersion`). Esta tabla unificó lo que antes eran dos fuentes de verdad separadas: un array estático en código y una tabla `CarreraConfig` solo para carreras dinámicas.

**CarreraVersion**
Modela las versiones del plan de estudios de una carrera (ej: `v1`, `v2`). Referencia el archivo JSON con el contenido del plan (`jsonFile`) y apunta al `Plan` publicado que respalda esa versión.

**Plan**
Tabla unificada para el ciclo de vida de un plan. Antes existían tres tablas separadas (`PlanBorrador`, `PlanPendiente`, `PlanPublicado`) con campos inconsistentes entre sí. Se consolidaron en una sola tabla con un enum `estado`:

| Estado | Significado |
|--------|-------------|
| `BORRADOR` | Generado al parsear un PDF, pendiente de revisión |
| `PENDIENTE` | Enviado por moderador, esperando aprobación de admin |
| `PUBLICADO` | Visible para los usuarios |
| `INACTIVO` | Desactivado temporalmente sin perder historial |

El campo `fuente` (enum `PlanFuente`) indica si el JSON fue generado por el parser local Python (`PARSER`), por Gemini con visión nativa (`GEMINI`), o fusionado manualmente en el panel admin (`MERGED`). El campo `esBackup` reemplaza el mecanismo anterior donde los backups se guardaban con el slug `"{slug}_v1_backup"` dentro de la misma tabla.

**UserPlanProgress**
Almacena el progreso del usuario en un plan: qué materias aprobó, cursó o no cursó. El estado se representa como un objeto JSON `{ [materiaId]: "aprobada" | "cursada" | "no_cursada" }` que se sobreescribe completo en cada sincronización.

**ProgressShare**
Snapshot inmutable del progreso de un usuario en un momento dado, identificado por un token público. Se crea al compartir el progreso y no se actualiza si el usuario modifica su avance después. Esto garantiza que el link siempre muestre el estado del momento en que se compartió.

**ScheduleBlock**
Bloques del planificador semanal: cada fila representa una materia ubicada en un día y rango horario. `dia` va de 0 (lunes) a 6 (domingo), y los horarios se almacenan como enteros HHMM (ej: `830`, `1000`).

**AdminConfig**
Singleton (`id = "singleton"`) que almacena los prompts enviados a Gemini para parsear PDFs. Editable desde el panel admin sin necesidad de redeploy.

**AuditLog**
Log append-only de acciones administrativas. `actorEmail` y `actorRole` están desnormalizados intencionalmente: reflejan la identidad del actor en el momento del evento, no el estado actual del usuario. Esto garantiza que el historial de auditoría sea fidedigno aunque el usuario sea eliminado o su rol sea modificado posteriormente.

### Relaciones principales

```
User ──< CarreraSeleccionada >── Carrera
User ──< UserPlanProgress >── CarreraVersion
User ──< ScheduleBlock >── CarreraVersion
User ──< UserRecentPlan >── CarreraVersion
CarreraVersion >── Plan
Carrera >── Departamento
```

### Decisiones de diseño relevantes

- **Desnormalización intencional en AuditLog**: `actorEmail` y `actorRole` se copian al momento del evento para preservar el contexto histórico, una práctica estándar en logs de auditoría.
- **`stateJson` como string serializado**: el progreso del usuario y los snapshots compartidos se almacenan como JSON serializado en un campo texto, lo que simplifica el modelo sin requerir una tabla de filas por materia.
- **`UserActivity` sin FK a planes**: los campos `planSlug` y `versionId` son strings libres, lo que preserva el log aunque el plan sea eliminado en el futuro.
- **Separación entre `UserPlanProgress` y `UserRecentPlan`**: ambas tablas referencian al mismo usuario y versión de plan, pero responden a preguntas distintas. `UserPlanProgress` almacena el estado académico del usuario (qué materias aprobó o cursó); `UserRecentPlan` registra cuándo abrió el plan por última vez. Sus ciclos de vida son independientes: `UserRecentPlan` se actualiza con un simple upsert cada vez que el usuario navega a un plan, aunque no interactúe con ninguna materia, mientras que `UserPlanProgress` puede no existir si el usuario nunca marcó nada. Unificarlas obligaría a crear filas de progreso vacías como efecto secundario de la navegación, mezclando dos eventos que el sistema trata por separado.

**Progreso del usuario como documento serializado**

El estado de avance del usuario en un plan se almacena como un único objeto JSON serializado (`stateJson`) en lugar de una tabla relacional con una fila por materia. Esta decisión responde al patrón de acceso real del sistema: el cliente siempre carga el progreso completo de un plan, el usuario interactúa con él localmente, y al sincronizar envía el estado completo de vuelta al servidor. No existen consultas del tipo "dame el estado de la materia X para el usuario Y" — la unidad mínima de lectura y escritura es siempre el progreso entero del plan.

Una tabla `EstadoMateria` con una fila por materia por usuario introduciría complejidad operativa sin beneficio funcional: cada sincronización requeriría un `DELETE` seguido de N inserciones (o un upsert por materia), y cada lectura requeriría reconstruir en memoria el mismo objeto que ya existe serializado. El costo de coordinación supera al beneficio.

La alternativa relacional sería justificada si el sistema requiriera consultas analíticas transversales, como "cantidad de usuarios que aprobaron una materia dada" o "materias con mayor tasa de recursado". Ese tipo de consulta no forma parte de los requisitos actuales del sistema, y en caso de incorporarse en el futuro podría resolverse con una vista materializada o un proceso de agregación sobre los JSON existentes, sin necesidad de cambiar el modelo de almacenamiento principal.
