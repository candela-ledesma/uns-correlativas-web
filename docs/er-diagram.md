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
  }
  Account {
    string provider PK
    string providerAccountId PK
    string userId FK
  }
  Session {
    string sessionToken PK
    string userId FK
    DateTime expires
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
  }
  CarreraSeleccionada {
    string id PK
    string userId FK
    string careerId FK
  }
  UserRecentPlan {
    string id PK
    string userId FK
    string careerId FK
    string planVersionId FK
    DateTime openedAt
  }
  UserPlanProgress {
    string id PK
    string userId FK
    string planVersionId FK
    string stateJson
    DateTime updatedAt
  }
  ProgressShare {
    string id PK
    string token
    string planVersionId FK
    string stateJson
    DateTime createdAt
  }
  ScheduleBlock {
    string id PK
    string userId FK
    string careerId FK
    string planVersionId FK
    string materiaNombre
    int dia
    int horaInicio
    int horaFin
  }
  Departamento {
    string id PK
    string nombre
  }
  Carrera {
    string id PK
    string nombre
    string departamentoId FK
    string defaultVersionId
    boolean disponible
  }
  PlanVersion {
    string id PK
    string carreraId FK
    string versionId
    string jsonFile
    string planId FK
    boolean disponible
  }
  Plan {
    string id PK
    string slug
    PlanEstado estado
    PlanFuente fuente
    string planJson
    boolean esBackup
  }
  AdminConfig {
    string id PK
    string systemPrompt
    string genericPrompt
    string version
  }
  AuditLog {
    string id PK
    string actorUserId FK
    string actorEmail
    Role actorRole
    string action
    string entityType
    string entityId
    DateTime createdAt
  }

  User ||--o{ Account : "has"
  User ||--o{ Session : "has"
  User ||--o| UserPreference : "has"
  User ||--o{ CarreraSeleccionada : "selects"
  User ||--o{ UserRecentPlan : "recently viewed"
  User ||--o{ UserPlanProgress : "tracks"
  User ||--o{ ScheduleBlock : "schedules"
  User ||--o{ AuditLog : "audited by"
  Departamento ||--o{ Carrera : "groups"
  Carrera ||--o{ PlanVersion : "has"
  Carrera ||--o{ CarreraSeleccionada : "selected in"
  Carrera ||--o{ UserRecentPlan : "referenced in"
  Carrera ||--o{ ScheduleBlock : "used in"
  PlanVersion ||--o{ UserPlanProgress : "tracks"
  PlanVersion ||--o{ UserRecentPlan : "referenced in"
  PlanVersion ||--o{ ScheduleBlock : "used in"
  PlanVersion ||--o{ ProgressShare : "shared as"
  Plan ||--o{ PlanVersion : "backs"
