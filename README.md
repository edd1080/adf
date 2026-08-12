# ADF — Agentic Development Framework

ADF es un harness reproducible para iniciar y gobernar desarrollos con Codex u OpenCode sobre GitHub Spec Kit. Externaliza el contexto en archivos, separa intake global de especificaciones por feature y exige aprobación humana antes de implementar.

> El agente no recuerda; el repositorio sí.

## Estado de `0.1.0`

Esta versión está publicada en npm como el paquete público `adf-harness-kit`. Ningún comando de ADF ejecuta commits, pushes, despliegues ni publicaciones del proyecto objetivo.

## Inicio rápido

Requisitos: Node.js 20 o posterior, Git, `uv`, una versión oficial fijada de Spec Kit y Codex u OpenCode.

```bash
uv tool install specify-cli --from git+https://github.com/github/spec-kit.git@vX.Y.Z
npx adf-harness-kit@latest
```

El comando sin subcomandos abre el wizard guiado. Para un preview explícito:

```bash
npx adf-harness-kit@latest init /ruta/mi-proyecto --agent codex --dry-run
```

Primer mensaje:

```text
Inicia el proyecto.
```

Para OpenCode, cambia `--agent codex` por `--agent opencode` y abre `opencode`. Para preparar ambos adaptadores usa `--agent codex --also opencode`.

El instalador inspecciona y presenta un plan; no entrevista sobre el producto. La entrevista documental ocurre dentro de la primera sesión del agente, donde `project-intake` descubre lo existente y pregunta solo por información o decisiones que no puede obtener del repositorio.

## Comandos

```text
npx adf-harness-kit@latest
npx adf-harness-kit@latest init [target] [--agent codex|opencode] [--also ...] [--dry-run] [--yes] [--json]
adf init [target] [--agent codex|opencode] [--also ...] [--dry-run] [--yes] [--json]
adf doctor [target] [--json]
adf status [target] [--json]
adf next [target] [--json]
adf update [target] [--check] [--yes] [--json]
```

Los códigos de salida son `0` para éxito, `1` para validación fallida, `2` para uso inválido del CLI y `3` para un conflicto que requiere decisión humana.
Para `init --json`, añade `--dry-run` (preview) o `--yes` (aplicación) para conservar stdout como un único documento JSON sin prompts interactivos.

## Documentación

- [Guía oficial Day Zero](docs/day-zero.md)
- [Arquitectura y propiedad de archivos](docs/architecture.md)
- [Actualizaciones seguras](docs/upgrades.md)
- [Solución de problemas](docs/troubleshooting.md)
- [Diseño aprobado](docs/design/adf-framework-design.md)
- [Evidencia de verificación](docs/verification/v0.1.0.md)

## Desarrollo del framework

ADF se desarrolla como producto; no se instala dentro de su propio repositorio fuente. Todas las pruebas de bootstrap se ejecutan en directorios temporales clean-room.

```bash
npm ci
npm run verify
npm pack
```

La publicación de cada release requiere verificación, versión explícita y credenciales del mantenedor.
