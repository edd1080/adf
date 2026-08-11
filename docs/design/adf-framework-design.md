# ADF — Agentic Development Framework

**Estado:** diseño aprobado  
**Versión objetivo:** `0.1.0`  
**Fecha:** 2026-08-10  
**Herramientas objetivo:** Codex y OpenCode  
**Motor SDD:** GitHub Spec Kit

## 1. Resumen ejecutivo

ADF es un harness reproducible para iniciar, documentar, especificar, implementar y verificar proyectos de software con agentes. Su premisa es:

> El agente no recuerda; el repositorio sí.

ADF no reemplaza Spec Kit. Añade la capa que falta alrededor de una feature: arranque desde cero, descubrimiento documental, memoria entre sesiones, selección explícita de skills, gates humanos, evidencia de verificación y portabilidad entre Codex y OpenCode.

La distribución tendrá dos caras complementarias:

- Un repositorio GitHub será la fuente canónica de código, plantillas, schemas, skills, pruebas y releases.
- Un paquete npm ejecutable mediante `npx` será la entrada Day Zero.

Experiencia objetivo:

```bash
mkdir mi-proyecto
cd mi-proyecto
git init
npx adf-harness-kit@0.1.0 init .
codex .
```

Primer mensaje al agente:

```text
Inicia el proyecto.
```

El agente inspecciona primero, pregunta solamente por lo que no puede saber, ayuda a construir la documentación faltante y avanza automáticamente hasta el siguiente gate humano. No inicia código antes de G4.

## 2. Objetivos

### 2.1 Objetivos de producto

1. Convertir un directorio vacío o un repositorio existente en un entorno de desarrollo gobernado.
2. Permitir que el usuario cree la documentación inicial junto con el agente.
3. Separar claramente hechos, referencias, borradores, propuestas y requerimientos aprobados.
4. Hacer que una sesión nueva reconstruya el estado sin depender del historial del chat.
5. Usar Spec Kit para el ciclo de cada feature sin duplicar su responsabilidad.
6. Compartir reglas y skills entre Codex y OpenCode.
7. Probar el harness como software: instalación, triggers, comportamiento, continuidad y upgrades.
8. Exigir evidencia antes de declarar trabajo terminado.

### 2.2 No objetivos de `0.1.0`

- Reemplazar el gestor de dependencias del proyecto anfitrión.
- Elegir automáticamente el stack de la aplicación.
- Publicar commits, pushes, PRs o deployments sin autorización explícita.
- Convertir toda referencia encontrada en requerimiento.
- Instalar todas las skills de un repositorio externo.
- Resolver decisiones de negocio mediante inferencias del código.
- Implementar un issue tracker remoto.
- Soportar todos los agentes disponibles en Spec Kit desde la primera versión.

## 3. Principios inmutables

1. **Inspect before asking.** El agente inspecciona antes de pedir información.
2. **Plan before code.** Toda tarea no trivial necesita spec, plan, DoD y autorización.
3. **Approval is not validation.** Un check verde no reemplaza una aprobación humana.
4. **One source of truth per concern.** No habrá dos archivos compitiendo por el mismo estado.
5. **Approved beats inferred.** Los documentos aprobados gobiernan sobre inferencias y referencias.
6. **Evidence before done.** Cada afirmación de cierre apunta a evidencia ejecutada.
7. **Minimal authorized diff.** El agente modifica únicamente el alcance autorizado.
8. **No silent external actions.** Nada de commit, push, deploy, mensajes o mutaciones externas implícitas.
9. **Idempotent bootstrap.** Repetir `adf init` no duplica ni destruye personalizaciones.
10. **Pinned inputs.** Framework, Spec Kit y skills tienen versión o commit fijado.
11. **Safe autonomy.** El agente puede leer, analizar, redactar borradores autorizados y validar; se detiene ante decisiones.
12. **Sessions are checkpoints, not units of scope.** Una feature puede ocupar varias sesiones sin duplicar planes.

## 4. Arquitectura del sistema

ADF se divide en cinco capas:

```text
┌────────────────────────────────────────────────────────────┐
│ 1. CLI: init, doctor, status, next, update                │
├────────────────────────────────────────────────────────────┤
│ 2. Harness: AGENTS.md, STATE, HANDOFF, LESSONS, manifest │
├────────────────────────────────────────────────────────────┤
│ 3. Skills: intake, sesiones, contexto, QA y skills Matt  │
├────────────────────────────────────────────────────────────┤
│ 4. Spec Kit: constitution, spec, plan, tasks, workflows  │
├────────────────────────────────────────────────────────────┤
│ 5. Adapters: Codex y OpenCode                            │
└────────────────────────────────────────────────────────────┘
```

### 4.1 Responsabilidad de cada capa

| Capa | Responsabilidad | No debe hacer |
|---|---|---|
| CLI | Instalación, inspección, preview, validación, upgrades | Tomar decisiones de producto |
| Harness | Estado global, routing, sesiones, gates | Duplicar los artefactos de feature |
| Skills | Procedimientos especializados y activación contextual | Convertirse en un monolito de instrucciones |
| Spec Kit | Ciclo de vida de cada feature | Gobernar el intake global del proyecto |
| Adapters | Traducir el harness a cada agente | Mantener reglas de negocio propias |

## 5. Estructura del repositorio generado

```text
proyecto/
├── AGENTS.md
├── .harness/
│   ├── manifest.yml
│   ├── STATE.md
│   ├── HANDOFF.md
│   ├── LESSONS.md
│   └── sessions/
│       └── archive/
├── .agents/
│   └── skills/
│       ├── project-intake/
│       ├── session-start/
│       ├── context-router/
│       ├── bug-fix/
│       ├── verify-work/
│       ├── feature-close/
│       ├── session-end/
│       └── vendor/
├── .specify/
│   ├── integration.json
│   ├── memory/
│   │   └── constitution.md
│   └── workflows/
├── specs/
│   └── NNN-feature/
│       ├── spec.md
│       ├── plan.md
│       ├── tasks.md
│       ├── checklists/
│       └── verification.md
├── docs/
│   ├── product/
│   │   ├── brief.md
│   │   ├── prd.md
│   │   ├── roadmap.md
│   │   ├── glossary.md
│   │   └── user-flows/
│   ├── design/
│   ├── architecture/
│   ├── decisions/
│   └── references/
│       └── index.md
├── .codex/                         # solo si una capacidad verificada lo requiere
│   └── config.toml                 # no se genera vacío ni con claves especulativas
├── opencode.json
└── .opencode/
    └── agents/
```

`docs/` contiene conocimiento del producto y del sistema. `.harness/` contiene estado operativo. `specs/` contiene la unidad ejecutable de trabajo. Ninguno sustituye a otro.

## 6. Fuentes de verdad y autoridad documental

### 6.1 Jerarquía

| Asunto | Fuente canónica |
|---|---|
| Reglas del agente | `AGENTS.md` |
| Configuración/versiones del harness | `.harness/manifest.yml` |
| Estado global y siguiente acción | `.harness/STATE.md` |
| Continuidad inmediata | `.harness/HANDOFF.md` |
| Errores generalizables | `.harness/LESSONS.md` |
| Principios técnicos | `.specify/memory/constitution.md` |
| Alcance del producto | `docs/product/prd.md` |
| Vocabulario | `docs/product/glossary.md` |
| Comportamiento por rol | `docs/product/user-flows/` |
| Decisiones difíciles de revertir | `docs/decisions/` |
| Feature actual | `specs/NNN-feature/` |
| Evidencia de cierre de feature | `specs/NNN-feature/verification.md` |

### 6.2 Estado documental

Cada documento gobernante debe declarar metadatos:

```yaml
---
title: Project PRD
status: draft # draft | review | approved | superseded
authority: product # product | technical | observational | reference
owner: human-name-or-role
last_reviewed: YYYY-MM-DD
---
```

Reglas:

- `approved` es una decisión humana explícita.
- `observational` describe lo descubierto en código o sistemas existentes.
- `reference` aporta contexto pero no gobierna.
- Los desconocidos se expresan como `[TBD — owner — blocker]`.
- Una contradicción no se resuelve escogiendo silenciosamente un documento.
- Un archivo `superseded` conserva enlace al reemplazo.

## 7. Intake documental

### 7.1 Documentos mínimos para G1

Obligatorios:

1. `docs/product/brief.md`
2. `docs/product/prd.md`
3. `.specify/memory/constitution.md`
4. `docs/references/index.md`

Condicionales por contexto:

- `docs/product/glossary.md`
- `docs/product/roadmap.md`
- `docs/product/user-flows/<role>.md`
- `docs/design/ux-guidelines.md`
- `docs/design/ui-guidelines.md`
- `docs/design/design-context.md`
- `docs/architecture/system-context.md`
- `docs/architecture/data-model.md`
- `docs/architecture/integrations.md`
- `docs/architecture/security.md`
- `docs/architecture/current-system.md` para brownfield
- Documentos de IA, privacidad, cumplimiento o migración cuando apliquen

### 7.2 Estrategias de intake

**Sin documentación:** entrevista guiada → brief → PRD → roles/flujos → condicionales → validación.

**Documentación parcial:** inventario → clasificación → contradicciones → gaps → borradores faltantes.

**Documentación completa:** validar autoridad, consistencia, trazabilidad y pendientes; no reescribir por estilo.

**Brownfield sin documentación:** generar documentos `observational`; el humano debe aprobar cualquier afirmación normativa.

### 7.3 Contrato de un flujo de usuario

Cada flujo por rol incluirá:

- Identificador y nombre.
- Rol principal y actores secundarios.
- Propósito y resultado esperado.
- Precondiciones.
- Trigger.
- Flujo principal paso a paso.
- Flujos alternos.
- Estados vacíos, carga, error y éxito.
- Permisos y restricciones.
- Datos leídos y escritos.
- Edge cases.
- Criterios de aceptación.
- Preguntas pendientes.
- Fuentes de respaldo.

## 8. Ciclo de vida y gates

```text
BOOTSTRAP
  → INTAKE
  → G1 PROJECT READY
  → FEATURE SELECTION
  → G2 SPECIFICATION READY
  → G3 PLAN READY
  → G4 IMPLEMENTATION AUTHORIZED
  → IMPLEMENTATION SLICES
  → G5 SLICE VERIFIED
  → G6 FEATURE CLOSED
```

### 8.1 Gate G0 — Harness Integrity

Requiere:

- Estructura y schemas válidos.
- Versiones y hashes presentes.
- Skills declaradas disponibles.
- Dependencias transitivas de skills resueltas.
- Integraciones de agente consistentes.
- Spec Kit accesible o instrucciones accionables para instalarlo.
- `adf doctor` satisfactorio.

### 8.2 Gate G1 — Project Intake

Requiere:

- Documentos mínimos presentes.
- Estado y autoridad declarados.
- Contradicciones bloqueantes resueltas.
- TBD bloqueantes identificados con owner.
- Roles/flujos requeridos definidos.
- Referencias indexadas.
- Aprobación humana explícita.

### 8.3 Gate G2 — Specification Ready

Requiere:

- Problema, alcance y fuera de alcance.
- Historias y criterios verificables.
- Edge cases.
- Requisitos funcionales y no funcionales aplicables.
- Trazabilidad a PRD/flujos/decisiones.
- Checklist de calidad satisfactoria.
- Aprobación humana explícita.

### 8.4 Gate G3 — Plan Ready

Requiere:

- Contexto técnico auditado.
- Archivos y seams previstos.
- Estrategia de pruebas.
- Orden de slices.
- Riesgos y migraciones.
- Mapeo completo al DoD.
- Análisis Spec Kit sin contradicciones bloqueantes.
- Aprobación humana explícita.

### 8.5 Gate G4 — Implementation Authorized

Requiere:

- G1–G3 satisfechos.
- Session Contract presentado.
- Alcance y comandos sensibles conocidos.
- `GO` humano explícito.

### 8.6 Gate G5 — Slice Verified

Requiere:

- Tests de la slice.
- Typecheck/lint/build aplicables.
- Verificación de comportamiento.
- Evidencia registrada.
- Regresiones relevantes ejecutadas.

### 8.7 Gate G6 — Feature Closed

Requiere:

- DoD completo con evidencia.
- Review contra estándares y spec.
- Documentación actualizada.
- Decisiones registradas si aplican.
- Debug instrumentation eliminado.
- `STATE.md`, `HANDOFF.md` y `verification.md` actualizados.
- Resultado `DONE`, `HANDOFF`, `BLOCKED` o `ABORTED` declarado.

## 9. Modos operativos

| Modo | Cuándo | Artefactos mínimos | Gates |
|---|---|---|---|
| Discovery | Falta claridad de producto | Docs de intake | G1 |
| Feature | Nuevo comportamiento | Spec, plan, tasks, verification | G2–G6 |
| Bug Fix | Comportamiento defectuoso | Repro, causa, test regresión, evidencia | G3–G6 adaptados |
| Quick Change | Cambio obvio y de bajo riesgo | Mini contrato, verificación | G4–G6 reducidos |
| Review | Análisis read-only | Fixed point, spec, hallazgos | Sin mutación |

`High Risk` es un overlay para seguridad, autenticación, pagos, datos personales, migraciones destructivas, permisos y producción. Añade aprobación y verificación específica; no es un sexto modo.

## 10. Sesiones

### 10.1 Inicio

`session-start` debe:

1. Leer `AGENTS.md`.
2. Leer manifest, estado, handoff y lessons relevantes.
3. Detectar feature y cambios del repositorio.
4. Consultar el DoD y documentación contextual.
5. Preguntar por decisiones tomadas fuera del repositorio.
6. Clasificar el modo.
7. Presentar un Session Contract.
8. Esperar `GO` cuando la sesión pretende mutar código.

Session Contract:

```yaml
objective: una sola meta primaria
mode: discovery | feature | bug-fix | quick-change | review
active_feature: null | NNN-name
in_scope: []
out_of_scope: []
source_docs: []
planned_verification: []
human_decisions_needed: []
```

### 10.2 Durante

- Una sesión trabaja sobre una feature y un objetivo primario.
- `specs/.../tasks.md` es el único listado de ejecución de la feature.
- No se crea `tasks/todo.md` paralelo.
- Cada bloque no trivial comienza con contexto, plan y DoD.
- Una contradicción con la spec detiene y replantea.
- Los avances se comunican por hitos, no por cada comando.

### 10.3 Cierre

`session-end` debe:

1. Inventariar cambios.
2. Ejecutar verificación proporcional.
3. Actualizar tasks y verification.
4. Actualizar state y decisiones.
5. Añadir lessons solo por correcciones generalizables.
6. Escribir el handoff autocontenido.
7. Archivar el handoff anterior cuando corresponda.
8. Reportar pendientes y siguiente acción exacta.
9. No hacer commit ni push sin autorización específica.

## 11. Router inicial de `AGENTS.md`

La primera instrucción gobernante será equivalente a:

```markdown
## Project Lifecycle Router

On every new session:

1. Read `.harness/manifest.yml` and `.harness/STATE.md`.
2. Read `.harness/HANDOFF.md` when present.
3. Read only the lessons relevant to the current mode.
4. Route from lifecycle state:
   - `intake` → invoke `project-intake`.
   - active handoff → invoke `session-start`.
   - project ready with no feature → guide feature selection.
   - active feature → load its Spec Kit artifacts.
5. Inspect before asking the user for information.
6. Never implement before Gate G4 and explicit `GO`.
7. Never commit, push, deploy, or mutate external systems without explicit authorization for that action.
```

`AGENTS.md` será corto: router, fuentes de verdad, gates y reglas de seguridad. El detalle procedural vivirá en skills para no cargar todo el contexto en cada turno.

## 12. Estrategia de skills

### 12.1 Skills propias

| Skill | Invocación | Responsabilidad |
|---|---|---|
| `project-intake` | Automática en lifecycle `intake` | Inventario y construcción documental |
| `session-start` | Automática al iniciar sesión operativa | Reconstrucción y Session Contract |
| `context-router` | Automática por tipo de trabajo | Cargar solamente documentos aplicables |
| `bug-fix` | Automática ante bug | Orquestar repro, diagnóstico y regresión |
| `verify-work` | Automática antes de afirmar cierre | Matriz de evidencia |
| `feature-close` | Explícita/automática en G6 | DoD, review, docs y resultado |
| `session-end` | Explícita | Estado, lessons y handoff |

### 12.2 Skills seleccionadas de Matt Pocock

Se incorporarán como copias adaptadas y fijadas a un commit, preservando licencia MIT, atribución, origen y hash. No se instalará el repositorio completo.

| Upstream | Uso en ADF | Adaptación |
|---|---|---|
| `grilling` | Entrevista por rondas | Integrada en intake |
| `grill-with-docs` | Descubrimiento stateful | Salidas redirigidas a docs canónicos |
| `domain-modeling` | Lenguaje ubicuo | `docs/product/glossary.md` y ADRs ADF |
| `codebase-design` | Seams y módulos profundos | Referencia de planificación |
| `tdd` | Red-green-refactor | Sin commits automáticos |
| `diagnosing-bugs` | Repro antes de hipótesis | Base de `bug-fix` |
| `code-review` | Revisión Standards + Spec | Fallback secuencial si no hay subagentes |
| `writing-great-skills` | Calidad de skills ADF | Referencia de autoría y triggers |

Notas verificadas:

- `grill-with-docs` depende de `grilling` y `domain-modeling`; el harness validará la terna.
- El flujo upstream de `implement` incluye commit automático, por lo que no se incorporará.
- `code-review` asume subagentes; la adaptación deberá admitir un modo secuencial en herramientas que no los tengan.
- La fuente upstream es MIT y recomienda seleccionar skills, aunque su instalador también permite escogerlas interactivamente. ADF evitará la instalación masiva y llevará un lock propio.

Opcionales, no incluidos en core:

- `research`
- `to-questionnaire`
- `prototype`
- `wayfinder`

Excluidos inicialmente:

- `implement`
- `to-spec`
- `to-tickets`
- `handoff`
- `grill-me`
- `setup-matt-pocock-skills`
- `triage`

## 13. Integración con Spec Kit

ADF utilizará:

- Constitución para principios.
- `specify`, `clarify`, checklists, plan, tasks y analyze para features.
- Preset ADF para plantillas y convenciones.
- Workflow ADF para gates y pausa/reanudación.
- Bundle ADF para distribución versionada cuando el CLI de Spec Kit utilizado lo soporte.

Spec Kit soporta Codex (`codex`) y OpenCode (`opencode`). También soporta instalaciones múltiples controladas: una integración es la predeterminada y otras pueden permanecer instaladas. ADF inicializará con la elegida por el usuario, instalará la segunda si es segura y registrará ambas. Cambiar la predeterminada requerirá una acción explícita porque presets y extensiones se rescaffoldean al activar una integración.

OpenCode reconoce el `AGENTS.md` raíz y descubre skills directamente en `.agents/skills/`. Por ello, ADF usará esos artefactos compartidos y evitará mantener una segunda copia en `.opencode/skills/`. `opencode.json` se limitará a configuración propia de OpenCode, como permisos y agentes read-only. Codex utilizará igualmente `AGENTS.md`, `.agents/skills/` y la integración oficial de Spec Kit; `.codex/config.toml` solo aparecerá si una capacidad verificada necesita una configuración de proyecto concreta.

Fuentes oficiales:

- [Spec Kit README](https://github.com/github/spec-kit)
- [Integraciones](https://github.github.com/spec-kit/reference/integrations.html)
- [Bundles](https://github.github.com/spec-kit/reference/bundles.html)
- [Workflows](https://github.github.com/spec-kit/reference/workflows.html)

### 13.1 Seguridad de workflows

Los pasos `shell` de Spec Kit ejecutan comandos con los privilegios del usuario y no tienen sandbox propio. Por tanto:

- ADF no instalará workflows remotos mutables en runtime.
- El source del workflow vendrá embebido y fijado.
- Cada paso shell estará en allowlist y será visible en preview.
- Operaciones destructivas o externas serán gates humanos.
- `requires` no se tratará como control de seguridad.

## 14. CLI Day Zero

### 14.1 Comandos de `0.1.0`

```bash
adf init [path]
adf doctor [path] [--json]
adf status [path] [--json]
adf next [path] [--json]
adf update --check [path]
adf update [path]
```

### 14.2 Flujo de `init`

1. Resolver y validar ruta explícita.
2. Detectar greenfield/brownfield.
3. Detectar Git y working tree.
4. Detectar archivos gobernantes y documentación.
5. Verificar Node, npm y Spec Kit.
6. Seleccionar agentes y default.
7. Construir un plan de cambios.
8. Clasificar cada path como `create`, `preserve`, `merge` o `conflict`.
9. Mostrar preview.
10. Pedir aprobación.
11. Aplicar en staging transaccional.
12. Inicializar/integrar Spec Kit.
13. Instalar archivos ADF.
14. Escribir manifest y estado inicial.
15. Ejecutar doctor.
16. Mostrar el prompt siguiente.

No se usará `--force` silenciosamente. Una ejecución no interactiva exigirá `--yes` y fallará ante cualquier conflicto no resuelto.

### 14.3 Estado inicial

```yaml
lifecycle: intake
current_gate: G1
active_feature: null
session_status: not_started
next_action:
  command: project-intake
  prompt: Inicia el proyecto.
```

## 15. Manifiesto y lock de procedencia

Ejemplo:

```yaml
schema_version: 1
framework:
  name: adf
  version: 0.1.0
  installed_at: 2026-08-10T00:00:00Z
spec_kit:
  version: 0.x.y
  default_integration: codex
  installed_integrations:
    - codex
    - opencode
skills:
  - name: project-intake
    source: adf
    version: 0.1.0
    sha256: "..."
  - name: grilling
    source: https://github.com/mattpocock/skills
    upstream_commit: "..."
    license: MIT
    adaptation: adf-0.1.0
    sha256: "..."
managed_files:
  - path: AGENTS.md
    strategy: merge-markers
    installed_sha256: "..."
```

El lock diferencia la copia upstream del contenido adaptado. Un upgrade compara hashes y jamás sobrescribe personalizaciones sin preview y aprobación.

## 16. Verificación

### 16.1 Perfiles

| Perfil | Cuándo | Evidencia |
|---|---|---|
| Docs | Intake/spec | Schema, links, contradicciones, aprobación |
| Quick | Cambio trivial | Test objetivo + checks relevantes |
| Standard | Feature normal | Unit/integration, typecheck, lint, build |
| High Risk | Overlay sensible | Standard + seguridad + rollback + revisión humana |
| Harness | Cambio ADF | Static + triggers + behavior + clean-room + upgrade |

### 16.2 `verification.md`

```markdown
| DoD item | Evidence command/artifact | Result | Date | Notes |
|---|---|---|---|---|
| CLI rejects conflict | `npm test -- init-conflict` | PASS | ... | No write |
```

### 16.3 Pruebas del harness

1. **Static:** schemas, links, frontmatter, skill dependency graph.
2. **Trigger:** cada modo invoca la skill correcta y evita falsos positivos.
3. **Behavior:** transcript fixtures prueban gates, stops y routing.
4. **Clean-room:** instalación en directorio vacío y brownfield sintético.
5. **Idempotency:** segunda instalación produce plan vacío.
6. **Conflict:** archivos de usuario se preservan.
7. **Upgrade:** versión anterior personalizada no se sobrescribe.
8. **Cross-agent:** Codex y OpenCode llegan al mismo lifecycle.

## 17. Distribución y releases

### 17.1 Repositorio canónico

```text
adf/
├── src/cli/
├── templates/
├── skills/
├── spec-kit/
├── schemas/
├── tests/
├── examples/
├── package.json
├── LICENSE
└── README.md
```

### 17.2 Estrategia

- `0.1.0`: starter validable, CLI local, intake, doctor, Codex/OpenCode, skills core.
- `0.2.0`: instalación desde release/npm, upgrades transaccionales, fixtures brownfield.
- `1.0.0`: bundle/preset/workflow estable y compatibilidad declarada.

Cada release incluye:

- Tag Git firmado cuando sea posible.
- Tarball npm.
- Checksums.
- Matriz de compatibilidad.
- Changelog y guía de migración.
- Resultado de clean-room tests.

## 18. Criterios de aceptación de `0.1.0`

1. Un usuario instala ADF en un directorio vacío con un comando.
2. El preview ocurre antes de la primera escritura.
3. `adf doctor` confirma o explica exactamente qué falta.
4. Codex y OpenCode leen un estado compartido.
5. `Inicia el proyecto` activa intake, no implementación.
6. El agente descubre documentos antes de preguntar.
7. El usuario puede construir brief, PRD y flujos durante varias sesiones.
8. G1 no se supera sin aprobación humana.
9. La primera feature usa los artefactos canónicos de Spec Kit.
10. G4 bloquea código hasta recibir `GO`.
11. Ningún flujo hace commit o push sin autorización específica.
12. Repetir la instalación no cambia archivos sin necesidad.
13. Un conflicto preserva el archivo del usuario y termina con instrucciones.
14. Las skills externas están fijadas, atribuidas y validadas con sus dependencias.
15. Una clean-room test recorre bootstrap → intake → G1 → feature ready sin intervención oculta.

## 19. Decisiones de distribución

- Paquete npm: `adf-harness-kit`.
- Repositorio GitHub: `edd1080/adf`.
- Política de firma de releases.
- Soporte Windows en `0.1.0` o `0.2.0`.
- Publicación de bundle en catálogo público de Spec Kit.

El nombre y repositorio quedaron resueltos para `0.1.0`; firma, soporte Windows y catálogo permanecen separados.

## 20. Riesgos principales

| Riesgo | Mitigación |
|---|---|
| `AGENTS.md` demasiado grande | Router delgado y progressive disclosure |
| Estados duplicados | Tabla explícita de fuentes de verdad |
| Skill externa cambia | Pin por commit, hash y adaptación local |
| Dependencias ocultas de skills | Grafo validado por doctor/tests |
| Spec Kit cambia CLI | Adapter con detección de capabilities, no comandos asumidos |
| Dos agentes generan artefactos distintos | Estado compartido + cross-agent fixtures |
| Automatización cruza una decisión | Gates humanos y estados paused |
| Workflow shell malicioso | Fuentes embebidas, preview y allowlist |
| Sobreingeniería del framework | Core pequeño, plugins opcionales, YAGNI |
| Docs se vuelven una segunda realidad | Authority/status, trazabilidad y review de drift |

## 21. Referencias

- [GitHub Spec Kit](https://github.com/github/spec-kit)
- [Spec Kit integrations](https://github.github.com/spec-kit/reference/integrations.html)
- [Spec Kit bundles](https://github.github.com/spec-kit/reference/bundles.html)
- [Spec Kit workflows](https://github.github.com/spec-kit/reference/workflows.html)
- [OpenCode rules and AGENTS.md](https://opencode.ai/docs/rules/)
- [OpenCode agent skills](https://opencode.ai/docs/skills)
- [npm: npx](https://docs.npmjs.com/cli/v11/commands/npx/)
- [Matt Pocock skills](https://github.com/mattpocock/skills)
- [Matt Pocock: domain-modeling](https://github.com/mattpocock/skills/blob/main/docs/engineering/domain-modeling.md)
- [Matt Pocock: grill-with-docs](https://github.com/mattpocock/skills/blob/main/docs/engineering/grill-with-docs.md)
- [Matt Pocock: codebase-design](https://github.com/mattpocock/skills/blob/main/docs/engineering/codebase-design.md)
- [Matt Pocock: diagnosing-bugs](https://github.com/mattpocock/skills/blob/main/docs/engineering/diagnosing-bugs.md)
- [Matt Pocock: code-review](https://github.com/mattpocock/skills/blob/main/docs/engineering/code-review.md)
- [Matt Pocock: MIT license](https://github.com/mattpocock/skills/blob/main/LICENSE)
