---
config:
  layout: dagre
---
erDiagram
  User {
    string id PK
    string name
    string email
    Role role
    DateTime createdAt
    DateTime updatedAt
  }
  Account {
    string provider PK
    string providerAccountId PK
    string userId FK
    string type
    DateTime createdAt
    DateTime updatedAt
  }
  Session {
    string sessionToken PK
    string userId FK
    DateTime expires
    DateTime createdAt
    DateTime updatedAt
  }
  VerificationToken {
    string identifier PK
    string token PK
    DateTime expires
  }
  UserPreference {
    string userId PK
    string activeCareerId
    DateTime onboardingCompletedAt
    DateTime onboardingDismissedAt
    DateTime createdAt
    DateTime updatedAt
  }
  PlanSeleccionado {
    string id PK
    string userId FK
    string careerId FK
    DateTime createdAt
  }
  UserRecentPlan {
    string id PK
    string userId FK
    string careerId FK
    string planVersionId FK
    DateTime openedAt
    DateTime updatedAt
  }
  UserPlanProgress {
    string id PK
    string userId FK
    string planVersionId FK
    string stateJson
    DateTime createdAt
    DateTime updatedAt
  }
  ProgressShare {
    string id PK
    string token
    string planVersionId FK
    string stateJson
    string createdBy
    DateTime createdAt
  }
  ScheduleBlock {
    string id PK
    string userId FK
    string careerId FK
    string planVersionId FK
    string materiaNombre
    string materiaId
    int dia
    int horaInicio
    int horaFin
    string comision
    string notas
    string color
    DateTime createdAt
    DateTime updatedAt
  }
  Departamento {
    string id PK
    string nombre
  }
  Carrera {
    string id PK
    string nombre
    string descripcion
    string departamentoId FK
    string defaultVersionId
    boolean disponible
    DateTime createdAt
    DateTime updatedAt
  }
  PlanVersion {
    string id PK
    string carreraId FK
    string versionId
    string label
    string jsonFile
    string planId FK
    boolean disponible
    boolean hidden
    DateTime createdAt
  }
  Plan {
    string id PK
    string slug
    PlanEstado estado
    PlanFuente fuente
    string planJson
    boolean esBackup
    string autorId
    DateTime createdAt
    DateTime updatedAt
  }
  AdminConfig {
    string id PK
    string systemPrompt
    string genericPrompt
    string version
    DateTime createdAt
    DateTime updatedAt
  }
  AuditLog {
    string id PK
    string actorUserId FK
    string actorEmail
    Role actorRole
    string authProvider
    string action
    string entityType
    string entityId
    string beforeJson
    string afterJson
    string reason
    string metadataJson
    DateTime createdAt
  }

  User ||--o{ Account : "has"
  User ||--o{ Session : "has"
  User ||--o| UserPreference : "has"
  User ||--o{ PlanSeleccionado : "selects"
  User ||--o{ UserRecentPlan : "recently viewed"
  User ||--o{ UserPlanProgress : "tracks"
  User ||--o{ ScheduleBlock : "schedules"
  User ||--o{ AuditLog : "audited by"
  Departamento ||--o{ Carrera : "groups"
  Carrera ||--o{ PlanVersion : "has"
  Carrera ||--o{ PlanSeleccionado : "selected in"
  Carrera ||--o{ UserRecentPlan : "referenced in"
  Carrera ||--o{ ScheduleBlock : "used in"
  PlanVersion ||--o{ UserPlanProgress : "tracks"
  PlanVersion ||--o{ UserRecentPlan : "referenced in"
  PlanVersion ||--o{ ScheduleBlock : "used in"
  PlanVersion ||--o{ ProgressShare : "shared as"
  Plan ||--o{ PlanVersion : "backs"

%% VerificationToken y AdminConfig no tienen relaciones con otras entidades.
%% VerificationToken: gestionada exclusivamente por NextAuth para magic link / email
%%   verification. No tiene FK a User por diseño de la spec de NextAuth (vincula por
%%   identifier = email, no por userId). NextAuth crea y borra estas filas solo.
%% AdminConfig: tabla singleton (id = "singleton"). Almacena prompts de Gemini
%%   editables desde el panel admin. Configuración global de la app, sin FK a ninguna entidad.
