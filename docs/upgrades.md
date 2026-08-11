# Actualizaciones de ADF `0.1.0`

`adf update` actualiza desde el paquete que ejecuta el comando o desde una composición local inyectada en pruebas. `0.1.0` no consulta un catálogo remoto ni descarga fuentes mutables.

## Procedimiento

1. Conserva una copia recuperable o checkpoint del proyecto.
2. Ejecuta la nueva versión pública con `--check`.
3. Revisa archivos nuevos, reemplazos seguros, conflictos y huérfanos.
4. Resuelve cualquier archivo gestionado que tenga cambios locales.
5. Ejecuta la actualización y después `adf doctor`.

```bash
npx adf-harness-kit@latest update /ruta/proyecto --check
npx adf-harness-kit@latest update /ruta/proyecto
npx adf-harness-kit@latest update /ruta/proyecto --yes
npx adf-harness-kit@latest doctor /ruta/proyecto
```

## Reglas

- Un archivo gestionado se reemplaza solo si sus bytes aún coinciden con el hash instalado.
- Un archivo modificado por el usuario produce conflicto y no se sobrescribe.
- Un archivo retirado de ADF se reporta como huérfano; `0.1.0` no lo elimina.
- El manifiesto, hashes y procedencia se actualizan juntos.
- Brief, PRD y demás conocimiento del proyecto no se reescriben durante un upgrade.

## Rollback

La transacción restaura archivos ADF afectados si falla al escribir. Cambios que una herramienta externa de Spec Kit haya realizado antes de fallar se reportan, pero deben revisarse con su propia procedencia. No uses `git reset --hard` como mecanismo automático de recuperación.

## Decisiones de release aún separadas

- Firma y checksums del release.
- Política de catálogo y actualización remota.
- Matriz formal de sistemas operativos.
- Publicación del bundle en un catálogo de Spec Kit.
