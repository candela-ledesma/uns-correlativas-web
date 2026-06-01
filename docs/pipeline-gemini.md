---
config:
  layout: dagre
---
graph TD
    A["<b>1. UI Admin</b><br/>Carga PDF en CargarPlanTab.tsx"] --> B["<b>2. Backend Route</b><br/>POST /api/admin/planes/parsear"]

    B --> C{"<b>3. Entorno</b>"}
    C -- "Producción" --> D["<b>Servidor Render</b><br/>/parse-gemini evita timeout 120s"]
    C -- "Local" --> E["<b>Llamada Directa</b><br/>Next.js Runtime"]

    D --> F["<b>4. API Gemini 2.5 Flash</b><br/>Base64 inlineData<br/>Prompt v33 | Temp 0"]
    E --> F

    F --> G["<b>5. Función extraerJSON</b><br/>Limpieza de Markdown y bloques"]

    G --> H["<b>6. Dashboard Admin</b><br/>Visualización JSON + Validación<br/>Guardar borrador: click manual"]

    classDef uiStep stroke:#818cf8,fill:#eef2ff
    classDef backendStep stroke:#a78bfa,fill:#f5f3ff
    classDef decision stroke:#facc15,fill:#fefce8
    classDef externalAPI stroke:#fb923c,fill:#fff7ed
    classDef processing stroke:#2dd4bf,fill:#f0fdfa
    classDef output stroke:#38bdf8,fill:#f0f9ff

    class A uiStep
    class B backendStep
    class C decision
    class D,E externalAPI
    class F externalAPI
    class G processing
    class H output
