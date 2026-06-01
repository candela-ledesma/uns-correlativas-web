---
config:
  layout: dagre
---
graph TD
    A["<b>1. UI Admin</b><br/>Carga PDF en CargarPlanTab.tsx"] --> B["<b>2. Backend Route</b><br/>POST /api/admin/planes/parsear-local"]

    B --> C{"<b>3. Entorno</b>"}
    C -- "Producción" --> D["<b>Servidor Render</b><br/>FastAPI /parse (Render)"]
    C -- "Local" --> E["<b>Subprocess local</b><br/>python -m core.parser"]

    D --> F["<b>4. Motor de Extracción</b><br/>pdfplumber + cleaner.py<br/>Clasificadores Regex"]
    E --> F

    F --> G["<b>5. Validación Schema</b><br/>contract_validator.py<br/>(solo en local)"]

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
    class F,G processing
    class H output
