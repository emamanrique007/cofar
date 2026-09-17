---
name: supabase
description: Edit Supabase declarative SQL sources under schemas/, including tables, RLS, RPCs, triggers, queues and storage. Use for database changes; do not generate migrations unless the user explicitly requests that workflow.
---

# Supabase

Las definiciones editables viven en `apps/next/supabase/schemas/`. El orden está en `[db.migrations].schema_paths` de `config.toml`.

## Flujo de trabajo

1. Localizar la definición en `tables.sql`, `functions.sql`, `policies.sql`, `triggers.sql` o los archivos de extensiones y storage.
2. Cambiar la definición fuente. No generar migraciones como efecto lateral de editar el esquema; el historial existente queda reservado al despliegue. Una instrucción explícita del usuario tiene prioridad sobre esta convención.
3. Tras cambiar tablas/columnas, revisar sus RPCs en `functions.sql`, triggers, políticas RLS, tipos compuestos, índices y payloads JSON. No dejar funciones con columnas obsoletas.
4. Actualizar `schema_paths` si cambia el orden de dependencias. Las definiciones representan el estado deseado; no ejecutar ciegamente todo el esquema sobre una base con datos.
5. Validar aislamiento entre cuentas, grants y SECURITY DEFINER (`search_path = ''`, nombres calificados, ejecución pública revocada). Storage privado exige bucket y carpeta de cuenta.
6. Aplicar y probar los cambios en el entorno autorizado, luego regenerar tipos con `pnpm gen:db-types:local` y ejecutar `pnpm db:test` y `pnpm typecheck`. No afirmar que la base está actualizada si solo se editaron fuentes SQL.

`pnpm db:reset` usa el historial de bootstrap y borra datos locales; no sustituye la aplicación de nuevos cambios declarativos. No ejecutar sobre datos que deban conservarse. Para remoto, `SUPABASE_PROJECT_ID` identifica exclusivamente el proyecto autorizado; `pnpm gen:db-types` solo lee su esquema.

Para colas, consultar `queues`; no introducir Redis/BullMQ. Los tipos generados en `packages/types/src/generated-database.types.ts` no se editan a mano.
