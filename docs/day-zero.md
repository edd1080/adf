# Guía oficial de ADF `0.1.0`

Esta guía describe el recorrido completo desde una máquina nueva hasta el instante previo a implementar la primera tarea. ADF instala el harness; el agente construye contigo la documentación que falte; Spec Kit gobierna la feature; los gates conservan las decisiones humanas.

## Ruta recomendada: pídele al agente que prepare ADF por ti

No necesitas operar la terminal personalmente. Si Codex u OpenCode tiene acceso al proyecto y a una terminal, puedes describir el resultado esperado y dejar que el agente ejecute los comandos. Esta ruta conserva las mismas revisiones y gates de seguridad que la ruta manual.

Antes de abrir el chat ten preparados tres datos:

- La ruta de la carpeta donde vivirá el proyecto.
- El agente principal: Codex u OpenCode.
- La carpeta donde colocaste la documentación creada previamente, si existe.

### Prompt 1 — Inspeccionar y mostrar el plan

Abre Codex u OpenCode en cualquier carpeta de trabajo segura y pega:

```text
Quiero preparar un proyecto para trabajar con ADF 0.1.0.

Proyecto objetivo:
[RUTA ABSOLUTA DEL PROYECTO]

Agente principal:
[CODEX U OPENCODE]

Agente adicional:
[CODEX, OPENCODE O NINGUNO]

Tienes autorización para usar la terminal únicamente para inspeccionar el entorno,
el paquete ADF y el proyecto objetivo.

Antes de escribir cualquier archivo:

1. Verifica Node.js, Git, uv y GitHub Spec Kit mediante sus comandos de versión.
2. Si falta un requisito, explícame cuál es y pide autorización antes de instalarlo.
3. Confirma que la ruta objetivo no sea el repositorio fuente de ADF.
4. Inspecciona si el proyecto está vacío, ya tiene código o ya tiene documentación.
5. Ejecuta solamente el preview de ADF con el equivalente de:
   npx adf-harness-kit@latest init [PROYECTO] --agent [AGENTE] --dry-run
6. Si solicité ambos agentes, incluye --also con el agente adicional.
7. Explícame en lenguaje natural qué se crearía, combinaría, preservaría,
   dejaría intacto o bloquearía por conflicto.
8. No apliques la instalación todavía.
9. No uses --force.
10. No hagas commit, push, tag, publicación ni despliegue.

Detente después de presentar el preview y espera mi aprobación.
```

El agente debe mostrarte el plan antes de escribir. Que el preview sea técnicamente válido no significa que ya esté aprobado.

### Prompt 2 — Aplicar y validar el harness

Después de revisar el plan, responde en el mismo chat:

```text
Apruebo el preview de ADF.

Procede a aplicar exactamente ese plan en el proyecto objetivo.

1. Ejecuta la instalación de ADF usando el mismo paquete y selección de agentes.
2. Si el proyecto existente necesita una confirmación separada de Spec Kit,
   muéstramela; no la sustituyas con --force.
3. Ejecuta adf doctor, adf status y adf next sobre el proyecto.
4. Corrige únicamente problemas propios de la instalación aprobada.
5. No inicies una feature ni escribas código del producto.
6. No reorganices mi documentación existente.
7. No hagas commit, push, tag, publicación ni despliegue.

Al terminar, resume la evidencia de validación y dame el siguiente prompt exacto.
```

Si la instalación está sana, la siguiente acción debe ser:

```text
Inicia el proyecto.
```

### Prompt 3 — Iniciar el proyecto y aprovechar documentación existente

Abre Codex u OpenCode dentro del proyecto ya preparado. Si no tienes documentación previa, basta con enviar:

```text
Inicia el proyecto.
```

Si generaste el discovery, PRD, flujos u otros documentos previamente en Claude, ChatGPT u otra herramienta, colócalos dentro del proyecto y usa:

```text
Inicia el proyecto.

Ya coloqué la documentación disponible en:

[RUTA O CARPETA DE DOCUMENTACIÓN]

Antes de hacerme preguntas:

1. Lee AGENTS.md, el estado de ADF, la constitución y toda la documentación.
2. Haz un inventario de los documentos encontrados.
3. Clasifica cada fuente como producto, técnica, observacional o referencia.
4. Determina cuáles están completas, parciales, duplicadas, contradictorias
   u obsoletas.
5. Preserva los documentos originales y no los muevas, renombres ni reescribas
   sin mi aprobación.
6. Mapea lo existente contra el brief, PRD, constitución, índice de referencias
   y documentos condicionales que requiere este proyecto.
7. Reutiliza toda la información suficiente y pregúntame únicamente por gaps,
   contradicciones o decisiones que no estén respaldadas por las fuentes.
8. Si hace falta normalizar información, propón primero qué documentos
   canónicos crearías o actualizarías y de qué fuentes provendría cada sección.
9. Marca hechos no resueltos como TBD con responsable y efecto bloqueante.
10. No selecciones una feature ni escribas código antes de mi aprobación de G1.

Muéstrame primero el inventario, los gaps, las contradicciones y el plan documental.
```

Cuando el agente termine la consolidación, puedes pedir la revisión de G1 con:

```text
Revisa conmigo el contexto consolidado del proyecto.

Muéstrame:

1. El brief y el PRD canónicos.
2. Los documentos condicionales que aplican y por qué.
3. Las fuentes originales utilizadas.
4. Los TBD, contradicciones y decisiones todavía abiertas.
5. La evidencia de que los roles, flujos, edge cases y límites están cubiertos.
6. Lo que cambiaría en el estado del harness si apruebo G1.

No apruebes G1 por mí y no inicies todavía la primera feature.
```

Solo después de revisar esa evidencia debes responder explícitamente que apruebas G1.

### Qué ocurre si ya tienes casi toda la documentación

ADF no debe repetir el discovery ni entrevistarte desde cero. La skill `project-intake` primero inventaría los archivos, identifica qué información ya está respaldada y elige una de cuatro rutas:

- Sin documentación: entrevista guiada y creación de borradores.
- Documentación parcial: completar únicamente gaps y resolver contradicciones.
- Documentación aparentemente completa: auditar vigencia, autoridad, consistencia y trazabilidad.
- Proyecto existente: contrastar documentos con código y configuración como evidencia observacional.

Si tus archivos ya cubren el problema, usuarios, alcance, requisitos, reglas, flujos y edge cases, el trabajo se reduce a normalizarlos, señalar decisiones abiertas y preparar la evidencia de G1. “Normalizar” no significa reescribirlos por estilo.

Por ejemplo, estos documentos de entrada son perfectamente válidos:

```text
docs/
├── vision-general.md
├── requerimientos-del-cliente.md
├── funcionalidades.md
├── flujos-de-la-app.md
└── notas-de-reuniones.md
```

ADF debe preservarlos y puede construir una capa pequeña y predecible:

```text
docs/
├── product/
│   ├── brief.md
│   ├── prd.md
│   └── user-flows/
├── references/
│   └── index.md
├── vision-general.md
├── requerimientos-del-cliente.md
├── funcionalidades.md
├── flujos-de-la-app.md
└── notas-de-reuniones.md
```

Los documentos canónicos consolidan las decisiones vigentes y enlazan las fuentes; no tienen que duplicar cada párrafo de los originales.

### ¿Los documentos de entrada deben seguir una estructura específica?

No. Pueden ser documentos genéricos, exportaciones de un chat, notas, presentaciones o especificaciones con otra estructura. Son fuentes válidas siempre que su autoridad y vigencia puedan determinarse.

Antes de aprobar G1 sí conviene que la información gobernante quede representada en las rutas canónicas de ADF. Cada documento canónico debe tener, como mínimo:

- Ruta y propósito predecibles.
- Título.
- Estado: `draft`, `review` o `approved`.
- Autoridad: `product`, `technical`, `observational` o `reference`.
- Responsable y fecha de revisión.
- Secciones mínimas correspondientes a su tipo.
- Fuentes utilizadas.
- Contradicciones y TBD explícitos.

Esta capa canónica hace que una sesión futura encuentre rápidamente las decisiones importantes, mientras que los originales conservan todo el contexto y la evidencia.

ADF requiere para G1 `brief.md` y `prd.md`; un `README.md` puede servir como guía técnica o introducción, pero no sustituye ninguno de esos documentos.

### ¿Sigue siendo necesario un prompt maestro?

No necesitas trasladar un prompt maestro enorme con todas las reglas de desarrollo. Esa parte pasa a `AGENTS.md`, las skills, el estado, los handoffs, los gates y Spec Kit.

Lo que sí debes trasladar es el contexto del producto: los documentos creados durante discovery. En la mayoría de los proyectos, el reemplazo práctico del prompt maestro será:

```text
Inicia el proyecto.

La documentación preparada durante discovery está en [RUTA].
Inspecciónala antes de preguntarme cualquier cosa.
Preserva las fuentes originales y propón únicamente la normalización y los gaps
necesarios para llegar a G1.
```

El flujo queda así:

```text
Documentación creada en Claude o ChatGPT
→ incorporación al directorio del proyecto
→ inventario y clasificación por ADF
→ capa documental canónica
→ aprobación humana G1
→ primera feature gestionada con Spec Kit
```

## 1. Qué instala ADF

ADF agrega al proyecto objetivo:

- `AGENTS.md`: router del ciclo de vida y reglas comunes.
- `.harness/`: manifiesto, estado, handoff, lecciones y fuentes locales de Spec Kit.
- `.agents/skills/`: siete skills ADF y ocho skills adaptadas de Matt Pocock, fijadas por commit y hash.
- `docs/`: scaffolds mínimos para brief, PRD, glosario y referencias.
- `.specify/memory/constitution.md`: constitución inicial del proyecto.
- Adaptadores de OpenCode solo cuando se selecciona OpenCode.

ADF no genera una aplicación, no elige stack y no instala dependencias del producto.

## 2. Preparar una máquina

Instala Node.js 20 o posterior, Git, `uv` y el agente que usarás. Instala una release oficial específica de Spec Kit; reemplaza `vX.Y.Z` por el tag elegido y conserva esa decisión en tu control de cambios.

```bash
uv tool install specify-cli --from git+https://github.com/github/spec-kit.git@vX.Y.Z
specify version
node --version
```

ADF no instala Spec Kit silenciosamente. Si falta, termina sin escribir y muestra la remediación.

## 3. Obtener ADF

### Opción A — npx, recomendada

No necesitas clonar ni instalar ADF globalmente:

```bash
npx adf-harness-kit@latest
```

El comando sin subcomandos abre el wizard guiado. El paquete se descarga en la caché temporal administrada por npm.

### Opción B — tarball local

Desde un checkout confiable del repositorio ADF:

```bash
npm ci
npm run verify
npm pack
```

El resultado es un archivo como `adf-harness-kit-0.1.0.tgz`. Cópialo a la otra máquina mediante el canal que controles.

### Opción C — checkout del repositorio

```bash
git clone https://github.com/edd1080/adf.git
cd adf
npm ci
npm run verify
npm pack
```

Ninguna opción requiere instalar ADF globalmente.

## 4. Crear o abrir el proyecto objetivo

El objetivo puede ser un directorio vacío o un repositorio existente. ADF trata los archivos encontrados como propiedad del usuario hasta demostrar lo contrario mediante su manifiesto.

Primero ejecuta el preview:

```bash
npx adf-harness-kit@latest init /ruta/mi-proyecto --agent codex --dry-run
```

Revisa `CREATE`, `MERGE`, `PRESERVE`, `CONFLICT` y `NOOP`. Luego aplica:

```bash
npx adf-harness-kit@latest init /ruta/mi-proyecto --agent codex
```

Variantes:

```bash
# OpenCode solamente
npx adf-harness-kit@latest init /ruta/mi-proyecto --agent opencode

# Codex como integración principal y OpenCode adicional
npx adf-harness-kit@latest init /ruta/mi-proyecto --agent codex --also opencode

# Automatización local: solo aplica si el plan no tiene conflictos
npx adf-harness-kit@latest init /ruta/mi-proyecto --agent codex --yes --json
```

`--yes` omite únicamente la confirmación del plan. No aprueba G1–G4.
`init --json` exige `--dry-run` para un preview sin escrituras o `--yes` para aplicar; así stdout contiene exactamente un documento JSON y nunca se mezcla con un prompt interactivo.
En un repositorio no vacío que todavía no tenga Spec Kit, omite `--yes`: ADF muestra primero su preview y después Spec Kit solicita una confirmación separada para mezclar su scaffold. ADF nunca sustituye esa decisión por `--force` silencioso.

`init` es el motor determinista de instalación: inspecciona, planifica, inicializa Spec Kit, escribe el harness, registra sus assets y ejecuta doctor. No entrevista sobre el producto, no aprueba G1, no selecciona features y no escribe código de la aplicación.

## 5. Verificar la instalación

```bash
cd /ruta/mi-proyecto
npx adf-harness-kit@latest doctor .
npx adf-harness-kit@latest status .
npx adf-harness-kit@latest next .
```

El resultado esperado al inicio es:

```text
Inicia el proyecto.
```

## 6. Abrir la primera sesión

```bash
cd /ruta/mi-proyecto
codex .
# o
opencode
```

Envía exactamente:

```text
Inicia el proyecto.
```

El agente debe leer `AGENTS.md`, `.harness/STATE.md`, el manifiesto y la skill `project-intake`. Después inspecciona `docs/`, la constitución, referencias y —en brownfield— el código y configuración como evidencia observacional.

El agente no debe pedirte que llenes una lista genérica antes de inspeccionar. Tampoco debe implementar código durante intake.

## 7. Qué sucede según la documentación existente

### No hay documentación

El agente conduce una entrevista guiada y redacta borradores del brief, PRD y documentos condicionales. Pregunta por problema, usuarios, resultado, alcance, restricciones, fuentes, roles y flujos.

### Hay documentación parcial

El agente inventaría, clasifica autoridad y estado, detecta contradicciones y completa únicamente los gaps. No reescribe documentos existentes por estilo.

### La documentación parece completa

El agente audita vigencia, autoridad, consistencia, trazabilidad, decisiones abiertas y bloqueos. “Completo” no significa “aprobado”.

### Es un proyecto brownfield

El agente preserva código y reglas existentes, describe el comportamiento descubierto como `observational` y pide aprobación humana antes de convertir cualquier inferencia en requisito.

## 8. Documentación requerida antes de la primera feature

Para G1 siempre se requieren:

1. `docs/product/brief.md`
2. `docs/product/prd.md`
3. `.specify/memory/constitution.md`
4. `docs/references/index.md`

Se agregan solo cuando aplican: glosario, roadmap, flujos por rol, UX/UI y contexto de diseño, arquitectura, datos, integraciones, seguridad, privacidad, cumplimiento, IA o migración.

Cada flujo de usuario requerido debe incluir propósito, rol, precondiciones, trigger, pasos, alternativas, estados, permisos, datos leídos/escritos, edge cases, criterios de aceptación, preguntas y fuentes.

Los documentos gobernantes llevan `status`, `authority`, `owner` y `last_reviewed`. Una referencia aporta contexto; no se vuelve requerimiento por existir.

## 9. Gates y avance automático seguro

El agente puede avanzar automáticamente entre actividades que no requieren una decisión, pero debe detenerse en cada gate:

```text
G0 Harness íntegro
→ G1 Contexto del proyecto aprobado
→ G2 Especificación de feature aprobada
→ G3 Plan técnico aprobado
→ G4 Contrato de implementación y GO explícito
→ G5 Slice verificada
→ G6 Feature cerrada
```

Tests verdes aportan evidencia; no aprueban un gate. El workflow `adf-day-zero` termina al aprobar G4 y no contiene `speckit.implement`.

Cuando la capacidad de workflows está disponible, ADF instala la fuente local. También puede ejecutarse directamente:

```bash
specify workflow run .harness/spec-kit/workflow/workflow.yml \
  -i project_goal="Describir la primera feature" \
  -i integration=codex
```

Spec Kit persiste cada run bajo `.specify/workflows/runs/`. Para reanudar un gate:

```bash
specify workflow status
specify workflow resume RUN_ID --input g1_verdict=approve
```

Usa el verdict correspondiente a `g1_verdict`, `g2_verdict`, `g3_verdict` o `g4_verdict`. Rechazar mantiene el gate abierto para corregir evidencia.

## 10. Trabajo por sesiones

Sí: una feature puede ocupar varias sesiones. La sesión es un checkpoint, no una unidad artificial de alcance.

Al iniciar una sesión nueva:

```bash
adf next .
```

Pega la única acción que devuelve. Un handoff activo produce:

```text
Continúa el proyecto.
```

Al cerrar una sesión, la skill `session-end` actualiza estado, handoff, evidencia y lecciones pertinentes. El siguiente agente reconstruye el contexto desde archivos, no desde el chat anterior.

## 11. Operación cotidiana

```bash
adf doctor .          # integridad y remediaciones
adf status .          # lifecycle, gate, feature y blockers
adf next .            # una sola instrucción canónica
adf update . --check  # preview de actualización
adf update .          # muestra preview, pide confirmación y actualiza lo seguro
adf update . --yes    # aplica el preview sin confirmación interactiva
```

Un conflicto termina sin sobrescribir el archivo. Los archivos eliminados de una versión se reportan como huérfanos y no se borran automáticamente en `0.1.0`.

## 12. Límites de seguridad

ADF no autoriza commits, pushes, PRs, despliegues, publicación de paquetes ni mutaciones externas. Esas acciones requieren autorización específica. No guardes secretos en documentación, estado, handoffs o fixtures.

## 13. Qué ocurre justo antes de desarrollar

Antes de la primera modificación de producto deben existir:

- G1–G3 explícitamente aprobados.
- Feature Spec Kit con spec, plan y tasks.
- Session Contract con alcance, archivos, pruebas, riesgos y Definition of Done.
- G4 y `GO` humano explícitos.

Solo entonces empieza una sesión de implementación. Esa separación es el propósito central del harness.
