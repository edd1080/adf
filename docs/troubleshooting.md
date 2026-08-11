# Solución de problemas de ADF `0.1.0`

## `SPEC_KIT_MISSING`

ADF no encontró `specify`. Instala una release oficial fijada y comprueba la versión:

```bash
uv tool install specify-cli --from git+https://github.com/github/spec-kit.git@vX.Y.Z
specify version
```

ADF no hará esta instalación por ti.

## La versión de Spec Kit no tiene bundle o workflow

ADF detecta la capacidad y usa fuentes locales. Revisa:

```bash
specify bundle --help
specify workflow --help
adf doctor .
```

Algunas versiones carecen de `specify workflow validate`; no interpretes ese comando ausente como un error de producto. La estructura ADF se prueba estáticamente y el bundle puede validarse con `specify bundle validate --path ... --offline` cuando existe esa capacidad.

## `MANIFEST_INVALID`

No ejecutes update ni borres el manifiesto automáticamente. Repara `.harness/manifest.yml` o archívalo explícitamente después de verificar que representa una instalación abandonada.

## `MANAGED_HASH_MISMATCH`

Un archivo que ADF gestiona fue modificado. Compara el cambio, decide si debe convertirse en una personalización soportada y luego restaura o migra conscientemente. ADF no lo sobrescribe.

## Conflicto durante `init` o `update`

El código de salida `3` significa que se requiere una decisión humana. Usa `--dry-run` o `--check`, revisa el path reportado y conserva el archivo existente hasta resolver el ownership.

## OpenCode no encuentra skills

Comprueba que `AGENTS.md`, `.agents/skills/` y `opencode.json` existen. Ejecuta `adf doctor`. ADF usa el directorio portable `.agents/skills`; no duplica las skills en `.opencode/`.

## El agente intenta implementar durante intake

Detén la sesión. Ejecuta `adf status` y `adf next`, confirma que el estado está en G1 y vuelve a enviar `Inicia el proyecto.`. G4 y un `GO` explícito son obligatorios antes del código.

## `npm pack` falla por permisos del cache

Corrige el ownership del cache según el mensaje de npm o usa un cache temporal controlado para la operación. No uses `sudo npm pack`.

## Diagnóstico reproducible

```bash
adf doctor . --json
adf status . --json
specify version
specify integration status --json
```

Conserva stdout JSON separado de mensajes de progreso o errores en stderr.
