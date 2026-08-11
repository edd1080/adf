# Arquitectura de ADF `0.1.0`

## Capas

```text
CLI → Harness → Skills → Spec Kit → Adaptadores
```

- La CLI inspecciona, propone, aplica transaccionalmente, diagnostica y actualiza.
- El harness mantiene reglas, estado y continuidad global.
- Las skills cargan procedimientos según el contexto.
- Spec Kit mantiene los artefactos ejecutables de cada feature.
- Los adaptadores exponen el mismo contrato a Codex y OpenCode.

## Fuente y proyecto instalado son ámbitos distintos

El repositorio ADF contiene código, plantillas, schemas, pruebas y documentación del framework. No debe ejecutar `adf init` sobre sí mismo. Las pruebas de instalación crean proyectos temporales aislados y los eliminan después.

Un proyecto objetivo recibe los artefactos generados. Su `.harness/manifest.yml` registra versión, fecha inicial, versión detectada de Spec Kit, integraciones, hashes y procedencia de skills.

## Propiedad de archivos

| Clase                                            | Estrategia                                                      |
| ------------------------------------------------ | --------------------------------------------------------------- |
| `AGENTS.md`                                      | Bloque ADF delimitado; preserva contenido del usuario           |
| `opencode.json`                                  | Merge JSON; preserva claves ajenas al fragmento ADF             |
| Skills, adaptadores y paquete Spec Kit           | Reemplazo solo si el hash instalado no cambió                   |
| Brief, PRD, glosario, referencias y constitución | Preservar si ya existen                                         |
| Estado, handoff y lecciones                      | Estado vivo del proyecto; no forman parte de upgrades estáticos |

El planner produce acciones deterministas `create`, `merge`, `preserve`, `conflict` y `noop`. La escritura usa staging, verifica contención en el target y restaura bytes ADF ante fallos de la transacción.

## Fuentes de verdad

| Asunto                    | Fuente                            |
| ------------------------- | --------------------------------- |
| Reglas del agente         | `AGENTS.md`                       |
| Instalación y procedencia | `.harness/manifest.yml`           |
| Estado y siguiente acción | `.harness/STATE.md`               |
| Continuidad inmediata     | `.harness/HANDOFF.md`             |
| Lecciones generalizables  | `.harness/LESSONS.md`             |
| Producto aprobado         | `docs/product/`                   |
| Principios técnicos       | `.specify/memory/constitution.md` |
| Feature ejecutable        | `specs/NNN-feature/`              |

## Skills

ADF instala siete skills propias y una allowlist de ocho skills de Matt Pocock. Las externas están fijadas al commit registrado en `templates/skills/vendor/UPSTREAM.yml`, conservan licencia MIT y registran hashes original/adaptado y notas de adaptación.

## Spec Kit

ADF detecta capacidades mediante la CLI instalada. Si preset/workflow no están disponibles, conserva fuentes locales y reporta el fallback. El workflow G1–G4 no usa shell y termina antes de implementar. El bundle no requiere URLs mutables después de instalarse.

## Seguridad

- Ninguna operación añade `--force` silenciosamente.
- No hay comandos automáticos de Git, publicación o despliegue.
- Los symlinks que escapan del target bloquean la instalación.
- Un hash gestionado modificado produce conflicto.
- Las aprobaciones humanas no se derivan de tests ni diagnósticos verdes.
- Los pasos de workflow no interpolan entradas no confiables en shell; el workflow no contiene pasos shell.
