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

## 1. Introducción

### 1.1 Motivación

Las universidades publican sus planes de estudio en formato PDF: documentos diseñados para ser leídos por personas, no procesados por sistemas. Para un estudiante que quiere entender qué materias debe cursar antes de inscribirse a otra, o planificar su recorrido académico a lo largo de años, ese PDF ofrece poca ayuda. La información está ahí, pero no es interactiva, no responde preguntas, y no permite explorar dependencias entre materias de forma visual.

Este problema existe en la Universidad Nacional del Sur (UNS), donde cada carrera tiene su propio plan de estudios con correlativas, agrupadores de optativas, requisitos especiales expresados en prosa y estructuras que varían entre departamentos. Un estudiante que quiere saber si puede inscribirse a una materia debe rastrear manualmente una cadena de dependencias que puede atravesar varios años del plan.

La motivación de este trabajo es resolver ese problema: transformar los planes de estudio estáticos de la UNS en una aplicación web interactiva que permita a cada estudiante visualizar su situación académica, marcar el progreso de sus materias y entender qué caminos tiene disponibles para avanzar en su carrera.

### 1.2 Problema y Desafíos

El punto de partida del problema es la brecha entre el formato de publicación y el formato que requiere una aplicación interactiva. Los PDFs de planes de estudio de la UNS no siguen una estructura uniforme: algunas carreras usan tablas, otras listas, algunas expresan correlativas como IDs numéricos, otras las describen en prosa. Esta heterogeneidad hace que cualquier intento de extracción automática enfrente casos borde difíciles de anticipar.

El primer desafío técnico es convertir esos documentos en un JSON estructurado y validado que capture fielmente la información del plan: materias, años, cuatrimestres, correlativas para cursar y para rendir, agrupadores de optativas, grupos de idioma y requisitos especiales. Cualquier error en esta conversión se propaga directamente a la experiencia del usuario: si una correlativa está mal registrada, el sistema puede habilitar materias que el estudiante no debería poder cursar, o bloquear materias que sí debería tener disponibles.

El segundo desafío es la escala del problema de conversión. La UNS ofrece decenas de carreras. Mantener los JSONs actualizados manualmente cada vez que un plan cambia no es viable. Se necesita un pipeline que reduzca la intervención humana al mínimo y que pueda incorporar nuevos planes con el menor esfuerzo posible.

El tercer desafío es la validación. Dado que el pipeline involucra modelos de inteligencia artificial generativa, los outputs no son deterministas ni siempre correctos. Se requiere una estrategia de evaluación que permita medir la calidad del JSON generado y detectar errores antes de que lleguen a los usuarios.

### 1.3 Objetivo General

Diseñar e implementar un sistema que convierta planes de estudio universitarios en PDF a datos estructurados, y los publique en una aplicación web que permita a los estudiantes gestionar su progreso académico y explorar las dependencias entre materias de su carrera.

### 1.4 Objetivos Específicos

- Desarrollar un parser local en Python capaz de extraer materias, correlativas y agrupadores desde PDFs de planes de estudio de la UNS.
- Diseñar un schema JSON validado que represente fielmente la estructura de un plan de estudios, incluyendo correlativas, optativas e idiomas.
- Integrar un modelo de lenguaje de gran escala (Gemini) para generar JSONs directamente desde PDFs mediante visión nativa, como alternativa al parser local.
- Implementar una métrica de similitud que permita comparar el output del modelo contra el ground truth del parser local.
- Desarrollar una aplicación web que permita a los estudiantes visualizar planes de estudio, marcar su progreso y explorar correlativas de forma interactiva.
- Implementar un panel de administración que permita subir PDFs, comparar outputs del parser y del modelo, y publicar planes sin intervención técnica.

### 1.5 Organización del documento

El capítulo 2 describe el contexto institucional y las tecnologías utilizadas. El capítulo 3 presenta la arquitectura de la solución y el modelo de datos. El capítulo 4 detalla la implementación de los módulos principales. El capítulo 5 evalúa los resultados obtenidos mediante la métrica de comparación entre el parser local y el modelo de IA. El capítulo 6 presenta las conclusiones, lecciones aprendidas y trabajo futuro.

---

## 2. Contexto y Tecnologías

### 2.1 Contexto

La Universidad Nacional del Sur (UNS) es una universidad pública argentina con sede en Bahía Blanca. Ofrece carreras de grado distribuidas en múltiples departamentos, cada uno con autonomía para definir la estructura de sus planes de estudio. Esta autonomía se refleja en la heterogeneidad de los documentos: algunas carreras organizan el plan en tablas por año y cuatrimestre, otras en listas lineales; algunas expresan las correlativas como identificadores numéricos, otras las describen en prosa. No existe un formato unificado.

Los planes de estudio se publican únicamente en formato PDF, un formato diseñado para impresión y lectura humana. Para un sistema informático, extraer información estructurada de esos documentos requiere resolver primero el problema de la conversión: transformar un documento orientado a la presentación en datos procesables por una aplicación.

Este trabajo se enmarca también en el surgimiento de los modelos de lenguaje de gran escala (LLMs) con capacidades de visión: modelos que pueden recibir un PDF como imagen y razonar sobre su contenido visual sin requerir extracción de texto previa. Esta capacidad abre una vía alternativa al parsing clásico basado en reglas, con la posibilidad de generalizar a documentos con estructuras arbitrarias que serían difíciles de cubrir con heurísticas escritas a mano.

El sistema desarrollado en este trabajo aprovecha ambos enfoques: un parser local en Python como fuente de verdad verificable, y un modelo de IA generativa (Gemini) como mecanismo de conversión escalable, con un panel de administración que permite comparar ambos outputs antes de publicar.

### 2.2 Herramientas y Tecnologías

#### 2.2.1 Next.js y el ecosistema frontend

La aplicación web está construida con **Next.js 16**, un framework de React que combina renderizado del lado del servidor (SSR) y del lado del cliente (CSR) en un mismo modelo de componentes. Se eligió Next.js por su soporte nativo a rutas de API, que permite implementar el backend de la aplicación en el mismo proyecto sin necesidad de un servidor separado, y por su integración directa con Vercel para despliegue continuo.

El frontend usa **React 19** con **TypeScript** y **Tailwind CSS v4** para estilos. La visualización del grafo de correlativas se implementa con **@xyflow/react**, una biblioteca especializada en grafos interactivos basados en nodos y aristas que se renderiza directamente en el navegador.

La autenticación se maneja con **NextAuth v4** mediante el proveedor de Google OAuth. El adaptador de Prisma (`@next-auth/prisma-adapter`) sincroniza la sesión con la base de datos automáticamente al primer login.

La validación de schemas en runtime se realiza con **Zod v4**, tanto para los datos del formulario como para los schemas de los JSONs de planes de estudio.

#### 2.2.2 Prisma y PostgreSQL

La base de datos relacional es **PostgreSQL**, accedida a través de **Prisma ORM v6**. Prisma cumple tres roles en el proyecto: define el schema de la base de datos en un lenguaje declarativo propio (`schema.prisma`), genera un cliente TypeScript con tipado completo a partir de ese schema, y gestiona las migraciones de base de datos.

La instancia de PostgreSQL se aloja en **Neon**, una plataforma de PostgreSQL serverless con soporte a conexiones HTTP y WebSocket, elegida por su integración nativa con el modelo de despliegue serverless de Vercel. Neon provee dos URLs de conexión: una pooled (vía PgBouncer) para las funciones serverless, y una directa para las migraciones de Prisma que requieren una conexión persistente.

#### 2.2.3 Gemini y la API de Google GenAI

El componente de inteligencia artificial usa la API de **Google Generative AI** (`@google/genai`) para enviar PDFs directamente al modelo **Gemini 2.5 Flash** y recibir un JSON estructurado como respuesta. El PDF se transmite como `inlineData` en base64 con MIME type `application/pdf`, lo que permite que Gemini procese el documento con sus capacidades de visión nativa sin extracción de texto previa.

El modelo opera con temperatura 0 para maximizar la determinismo de los outputs. El prompt del sistema (almacenado en `frontend/lib/ai/prompt.ts` y editable desde la tabla `AdminConfig` de la base de datos sin necesidad de redeploy) instruye al modelo sobre el schema JSON de salida, las reglas de agrupadores de optativas, los grupos de idioma y los casos borde más frecuentes.

El sistema soporta múltiples modelos de Gemini intercambiables desde el panel admin: `gemini-2.5-flash` (modelo principal), `gemini-2.5-flash-lite`, `gemini-2.5-pro` y `gemma-4-26b-a4b-it`, con sus respectivos límites de rate configurados explícitamente en `frontend/lib/ai/models.ts`.

#### 2.2.4 Parser local en Python

El parser local está implementado en Python y expuesto como una API REST con **FastAPI** y **Uvicorn**. Recibe un PDF por multipart form-data y devuelve el JSON del plan de estudios. Internamente usa **pdfplumber** y **pdfminer.six** para la extracción de texto y la detección de layout, y aplica reglas de parsing específicas para los formatos de la UNS.

Este parser no reemplaza al modelo de IA: cumple el rol de generador del ground truth, produciendo el JSON de referencia contra el cual se evalúa la calidad del output de Gemini. La comparación entre ambos outputs se realiza con un script de evaluación (`scripts/comparar_json.py`) que calcula métricas de similitud sobre materias, correlativas y agrupadores.

#### 2.2.5 Despliegue: Vercel y Render

El frontend Next.js se despliega en **Vercel**, la plataforma de los creadores del framework. Vercel compila y publica automáticamente cada push a la rama principal, genera previews por pull request, y sirve las funciones serverless con routing y cold starts optimizados para Next.js. La integración nativa elimina la configuración de build pipelines y permite que los deployments de preview usen branches de Neon aisladas, sin contaminar la base de datos de producción.

El parser local en Python se despliega como un servicio independiente en **Render**. A diferencia de Vercel, Render permite ejecutar procesos de larga duración con workers persistentes, lo que es necesario para Uvicorn (el servidor ASGI de FastAPI). El parser no puede correr como función serverless porque el modelo de funciones stateless con cold starts cortos no es compatible con el tiempo de startup de un servidor Python con dependencias pesadas como pdfplumber. Render provee un plan gratuito con sleep automático tras inactividad, suficiente para el volumen de uso administrativo del sistema.

La separación en dos servicios independientes implica que el panel admin realiza dos requests distintos al subir un PDF: uno a las rutas de API de Vercel (para Gemini) y otro al endpoint de Render (para el parser local). Ambos corren en paralelo y sus resultados se muestran side by side en el panel de comparación.

#### 2.2.6 Asistentes de IA para desarrollo

El desarrollo del sistema utilizó herramientas de IA generativa como asistentes de programación. **Claude Code** (Anthropic) fue el agente principal: opera desde la terminal con acceso al sistema de archivos, ejecuta comandos, lee y edita código, y mantiene contexto del proyecto entre sesiones. Se usó para tareas de refactoring, generación de migraciones de base de datos, escritura de tests y resolución de errores de compilación.

Dentro de Claude Code se usaron **skills** especializadas — agentes con instrucciones y herramientas acotadas a un dominio específico — como `test-runner` (ejecuta pytest, vitest y playwright y analiza los resultados), `json-validator` (valida la estructura de los JSONs de planes contra el schema), `dispatcher` (coordina el pipeline batch de parseo y validación de múltiples PDFs), y `code-reviewer` (revisa calidad y patrones antes de commits). Estas skills corren como subagentes dentro de la sesión principal y reportan sus resultados de vuelta al agente coordinador.

El modelo base subyacente a Claude Code es **Claude Sonnet** de Anthropic. Para tareas de revisión de código y auditoría se usó también **Claude Opus**, la variante de mayor capacidad razonamiento. En paralelo, **GitHub Copilot** (basado en modelos de OpenAI) se usó para autocompletado inline en el editor durante el desarrollo del frontend.

#### 2.2.7 Testing

La suite de tests cubre tres niveles. Los **tests unitarios del parser** en Python (pytest) verifican que la extracción de texto y las reglas de parsing produzcan el JSON correcto para los PDFs del dataset. Los **tests de integración del frontend** (Vitest) cubren la lógica de validación de schemas y las utilidades de comparación. Los **tests end-to-end** (Playwright) verifican los flujos principales de la aplicación web contra un entorno de staging, incluyendo navegación, marcado de progreso y acceso al panel de administración.

### 2.3 Comparación de alternativas

**Parser basado en reglas vs. modelo de IA generativa.** Un parser basado en reglas (el parser Python del proyecto) ofrece alta predecibilidad y resultados verificables, pero requiere esfuerzo de mantenimiento proporcional a la diversidad de formatos. Cada variante estructural del PDF de una carrera puede requerir una nueva rama de lógica. Un modelo de IA generativa con capacidades de visión puede generalizar a formatos desconocidos sin código adicional, pero sus outputs no son deterministas y requieren validación. La arquitectura del sistema combina ambos: el parser como referencia y el modelo como motor de conversión escalable.

**PostgreSQL vs. base de datos documental.** El modelo de datos del sistema tiene entidades relacionales claras (usuarios, carreras, versiones, planes) que se benefician de las garantías transaccionales de una base relacional. El único dato que tiene naturaleza documental — el progreso del usuario en un plan — se almacena como JSON serializado dentro de un campo texto, una decisión de diseño que se justifica con detalle en la sección 3.3.4. Una base de datos exclusivamente documental (como MongoDB) habría simplificado ese campo pero complicado las relaciones entre entidades y las consultas transaccionales del panel admin.

**NextAuth vs. implementación propia de autenticación.** Implementar autenticación propia con Google OAuth requiere manejar el flujo de código de autorización, el intercambio de tokens, la renovación de sesiones y la persistencia de usuarios. NextAuth encapsula todo ese flujo en pocas líneas de configuración y se integra directamente con Prisma para la persistencia. La limitación es que NextAuth v4 tiene una API que puede resultar restrictiva para casos de uso avanzados, pero para el alcance de este sistema — autenticación con Google, sesiones por cookie, roles en base de datos — es suficiente y reduce significativamente la superficie de errores de seguridad.

**Vercel + Neon vs. despliegue propio.** La combinación de Vercel para el frontend y Neon para la base de datos permite un despliegue continuo sin configuración de infraestructura. Las funciones serverless de Vercel se escalan automáticamente, y Neon provee PostgreSQL serverless con branch por entorno (producción, preview). La alternativa de un servidor dedicado ofrecería más control sobre la infraestructura y costos predecibles a escala, pero para un sistema universitario con carga variable y picos ocasionales, el modelo serverless es más apropiado.

**Modelos de IA alternativos descartados.** Durante el desarrollo se evaluaron tres alternativas a Gemini para la generación de JSONs desde PDFs:

- **Grok (xAI)**: disponible vía API con capacidades multimodales, pero al momento de evaluación no ofrecía soporte estable para `inlineData` de PDFs y requería extracción de texto previa, lo que contradice la estrategia de visión nativa del proyecto.
- **Claude API (Anthropic)**: modelos con capacidades de visión comparables a Gemini y con mejor desempeño en seguimiento de instrucciones complejas. Se descartó por costo: el volumen de tokens por PDF (el documento completo en base64 más el prompt del sistema) resulta significativamente más caro en la API de Claude que en Gemini, especialmente considerando el plan gratuito disponible para Gemini durante la etapa de desarrollo.
- **Ollama (modelos locales)**: permite correr modelos open-source en hardware propio sin costo por token. Se descartó porque los modelos con capacidades de visión suficientes para PDFs complejos (LLaVA, Qwen-VL) requieren hardware con GPU dedicada para tiempos de respuesta aceptables, y la infraestructura disponible para el proyecto no lo permite. Además, la calidad de extracción en documentos con tablas y layouts complejos fue inferior a la de Gemini en las pruebas realizadas.

---

## 2.4 Problemas encontrados al usar Gemini

La integración con la API de Gemini presentó varios problemas concretos que condicionaron las decisiones de diseño del pipeline.

**Restricciones de la API gratuita.** Durante el desarrollo se usó el plan gratuito de Google AI Studio, que impone límites de tasa (rate limits) por minuto, por hora y por día: para `gemini-2.5-flash`, el plan gratuito permite 10 requests por minuto y 500 por día. Estos límites son suficientes para uso administrativo ocasional (subir un PDF y esperar el JSON), pero no para procesamiento batch de múltiples carreras en paralelo. El panel admin incluye manejo explícito de estos límites y muestra el estado de rate limit al usuario cuando se alcanza.

**Modelos disponibles y calidad.** No todos los modelos disponibles en la API de Gemini tienen la misma calidad para este caso de uso. `gemini-2.5-flash` resultó el mejor balance entre calidad de extracción y velocidad de respuesta. `gemini-2.5-pro` produce outputs de mayor calidad pero es significativamente más lento y tiene límites de rate más estrictos (5 requests/minuto en el plan gratuito). `gemma-4-26b-a4b-it`, el modelo open-weight de Google disponible vía API, resultó notablemente lento — tiempos de respuesta de varios minutos por PDF — y con calidad de extracción inferior para documentos con tablas complejas, lo que lo hace impractical para el flujo del panel admin.

**Problema de salto de página (page break).** Gemini tiene dificultades para detectar correctamente las correlativas de materias cuya entrada en el PDF está dividida entre dos páginas. Cuando el nombre de una materia aparece al final de una página y sus correlativas al inicio de la siguiente, el modelo frecuentemente omite las correlativas o las asocia a la materia incorrecta. Este es uno de los errores más frecuentes detectados al comparar el output de Gemini contra el ground truth del parser local.

**Confusión entre `I` y `1` en IDs.** Los identificadores de grupos de idioma en el schema del plan comienzan con la letra `I` mayúscula (ej: `I0001`, `I0002`). Gemini confunde sistemáticamente esta letra con el número `1`, generando IDs inválidos como `10001` en lugar de `I0001`. Este error es consistente y reproducible, y requirió una instrucción explícita en el prompt del sistema para mitigarlo, aunque no se eliminó completamente.

---

## 3.1. Descripción general — Arquitectura en capas

El sistema utiliza PostgreSQL como base de datos relacional, accedida a través de Prisma ORM. El schema está diseñado alrededor de tres ejes: autenticación y perfil de usuario, gestión del ciclo de vida de los planes de estudio, y trazabilidad de acciones administrativas.

### Entidades principales

**User**
Representa a un usuario autenticado. Se crea automáticamente al primer login con Google (vía NextAuth). El campo `role` controla el nivel de acceso: `USER` solo accede a la aplicación, `MODERATOR` puede enviar planes para revisión, `ADMIN` puede publicar planes, gestionar usuarios y editar la configuración del sistema.

**Carrera / Departamento**
`Carrera` es la entidad central del dominio académico: cada carrera tiene un identificador slug (ej: `ingenieria_civil`), pertenece a un `Departamento`, y puede tener múltiples versiones de plan (`PlanVersion`). Esta tabla unificó lo que antes eran dos fuentes de verdad separadas: un array estático en código y una tabla `CarreraConfig` solo para carreras dinámicas.

**PlanVersion**
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
User ──< PlanSeleccionado >── Carrera
User ──< UserPlanProgress >── PlanVersion
User ──< ScheduleBlock >── PlanVersion
User ──< UserRecentPlan >── PlanVersion
PlanVersion >── Plan
Carrera >── Departamento
```

### Decisiones de diseño relevantes

- **Desnormalización intencional en AuditLog**: `actorEmail` y `actorRole` se copian al momento del evento para preservar el contexto histórico, una práctica estándar en logs de auditoría.
- **`stateJson` como string serializado**: el progreso del usuario y los snapshots compartidos se almacenan como JSON serializado en un campo texto, lo que simplifica el modelo sin requerir una tabla de filas por materia.
- **Limitación conocida en `PlanSeleccionado`**: la FK `careerId` apunta a `Carrera`, no a `PlanVersion`. Esto significa que la selección del usuario es a nivel de carrera, no de versión específica del plan. Una migración futura debería agregar una FK opcional a `PlanVersion` para soportar selección por versión cuando una carrera tiene múltiples planes activos.
- **Separación entre `UserPlanProgress` y `UserRecentPlan`**: ambas tablas referencian al mismo usuario y versión de plan, pero responden a preguntas distintas. `UserPlanProgress` almacena el estado académico del usuario (qué materias aprobó o cursó); `UserRecentPlan` registra cuándo abrió el plan por última vez. Sus ciclos de vida son independientes: `UserRecentPlan` se actualiza con un simple upsert cada vez que el usuario navega a un plan, aunque no interactúe con ninguna materia, mientras que `UserPlanProgress` puede no existir si el usuario nunca marcó nada. Unificarlas obligaría a crear filas de progreso vacías como efecto secundario de la navegación, mezclando dos eventos que el sistema trata por separado.

**Progreso del usuario como documento serializado**

El estado de avance del usuario en un plan se almacena como un único objeto JSON serializado (`stateJson`) en lugar de una tabla relacional con una fila por materia. Esta decisión responde al patrón de acceso real del sistema: el cliente siempre carga el progreso completo de un plan, el usuario interactúa con él localmente, y al sincronizar envía el estado completo de vuelta al servidor. No existen consultas del tipo "dame el estado de la materia X para el usuario Y" — la unidad mínima de lectura y escritura es siempre el progreso entero del plan.

Una tabla `EstadoMateria` con una fila por materia por usuario introduciría complejidad operativa sin beneficio funcional: cada sincronización requeriría un `DELETE` seguido de N inserciones (o un upsert por materia), y cada lectura requeriría reconstruir en memoria el mismo objeto que ya existe serializado. El costo de coordinación supera al beneficio.

La alternativa relacional sería justificada si el sistema requiriera consultas analíticas transversales, como "cantidad de usuarios que aprobaron una materia dada" o "materias con mayor tasa de recursado". Ese tipo de consulta no forma parte de los requisitos actuales del sistema, y en caso de incorporarse en el futuro podría resolverse con una vista materializada o un proceso de agregación sobre los JSON existentes, sin necesidad de cambiar el modelo de almacenamiento principal.

---

## 4. Implementación (fragmentos seleccionados)

### 4.1 Detección de requisitos especiales

Algunas materias de los planes de estudio no tienen correlativas en el sentido estricto de "materia aprobada", sino condiciones más complejas expresadas en prosa en el PDF. El sistema las representa en el JSON como `requisitos_especiales`, un campo de texto libre que el parser local y Gemini intentan extraer tal como aparece en el documento.

Los tipos de requisitos especiales que aparecen con mayor frecuencia en los planes de la UNS son:

- **Mínimo de materias aprobadas**: "Haber aprobado al menos 15 materias del plan". Se expresa como una condición sobre la cantidad total de materias aprobadas, sin especificar cuáles. El sistema lo almacena como texto y lo muestra al usuario como advertencia, pero no lo evalúa automáticamente sobre el progreso marcado.

- **Año aprobado**: "Tener el primer año aprobado" o "tener aprobadas todas las materias de primero y segundo año". Es una condición sobre la totalidad de un bloque del plan, no sobre materias individuales. Al igual que el anterior, se almacena como texto y no se evalúa automáticamente.

- **Otros requisitos no cuantificables**: condiciones como "acreditar conocimientos de inglés", "tener regularidad en la carrera" o requisitos institucionales que no se pueden representar como dependencias entre nodos del grafo. Se almacenan como texto libre asociado a la materia.

La evaluación automática de estos requisitos sobre el progreso del usuario queda fuera del alcance de la versión actual del sistema y se registra como trabajo futuro.

### 4.2 Cursado paralelo

El modelo de correlativas del sistema asume que para habilitar una materia se deben tener aprobadas (o cursadas, según el tipo de correlativa) las materias previas. Este modelo no contempla el cursado paralelo: la posibilidad de inscribirse a una materia al mismo tiempo que se cursa otra que es correlativa de la primera, cuando el reglamento de la carrera lo permite.

Los planes de estudio de la UNS no siempre especifican explícitamente si una correlativa admite paralela o no. En la versión actual, el sistema trata todas las correlativas como estrictas: una materia solo se habilita si sus dependencias están marcadas como aprobadas o cursadas según corresponda, sin considerar inscripción simultánea como condición válida. La representación de paralelas en el schema JSON y su evaluación correcta en el grafo de habilitación queda como trabajo futuro.

### 4.3 Múltiples versiones de un plan

El schema de base de datos soporta múltiples versiones de un plan por carrera mediante la entidad `PlanVersion`: cada versión tiene su propio `versionId` (ej: `v1`, `v2`), su propio archivo JSON y su propio `Plan` publicado. El campo `Carrera.defaultVersionId` indica cuál es la versión activa que ve un usuario nuevo.

Esto permite mantener en paralelo, por ejemplo, el plan 2015 y el plan 2022 de una misma carrera. Un estudiante que ingresó bajo el plan 2015 puede seguir usando esa versión, mientras que los ingresantes del 2022 ven el plan nuevo. El progreso de cada usuario está anclado a su `PlanVersion` específica y no se ve afectado cuando se publica una versión nueva.

Sin embargo, en la versión actual del panel admin el flujo de publicación no crea versiones nuevas: siempre sobreescribe la versión existente. La opción "Guardar como nueva versión" está implementada en la UI pero deshabilitada en el backend, pendiente de una decisión de diseño sobre cómo exponer el selector de versiones a los usuarios finales. Esta funcionalidad se registra como trabajo pendiente.

---

## 6. Conclusiones

### 6.3 Trabajo futuro

Las siguientes líneas de trabajo quedaron fuera del alcance de esta versión pero están identificadas como extensiones naturales del sistema:

- **Historia académica automática**: permitir que el usuario suba el PDF de su historia académica y que el sistema marque automáticamente las materias aprobadas y cursadas en el plan, sin necesidad de ingresarlas manualmente una a una.

- **Nota y promedio por materia**: ampliar el modelo de progreso para que el usuario pueda registrar la nota obtenida en cada materia aprobada. Con esa información el sistema podría calcular el promedio académico y proyectarlo a futuro.

- **Mejora paralela del prompt y el parser**: el parser local y el prompt de Gemini evolucionan de forma independiente hoy. Una línea de mejora es usar los errores detectados por el comparador como señal de retroalimentación para iterar ambos en paralelo, construyendo un dataset incremental donde cada nuevo plan correcto se convierte en un caso de prueba adicional.

- **Integración completa de carreras pendientes**: la UNS tiene decenas de carreras aún no incorporadas al sistema. Completar la cobertura requiere procesar los PDFs restantes, validar los JSONs generados y publicarlos en el panel admin.

- **Evaluación automática de requisitos especiales**: implementar la evaluación de las condiciones de mínimo de materias aprobadas y año completo aprobado directamente sobre el progreso marcado por el usuario, para que el sistema pueda bloquear o habilitar materias con requisitos especiales de forma automática.

- **Soporte de cursado paralelo**: extender el schema JSON y la lógica de habilitación para representar correlativas que admiten inscripción simultánea, cuando el reglamento de la carrera lo permite.

- **Selector de versiones de plan para el usuario**: completar el flujo de publicación de nuevas versiones en el panel admin y diseñar la experiencia de selección de versión para los usuarios finales, de modo que estudiantes de distintos años de ingreso puedan trabajar con el plan que les corresponde.
