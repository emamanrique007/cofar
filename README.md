# Cofar

Configuración: [entorno y Zod](docs/environment.md). Skills y reglas: [AGENTS.md](AGENTS.md).

Turborepo con pnpm, Next App Router, tRPC, React Query, Tailwind 4 y Supabase (Auth, PostgreSQL/RLS, Storage, Realtime, PGMQ y Cron).

## Desarrollo local

Requisitos: Node 24, Corepack y Docker. La versión de pnpm está fijada en package.json.

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm db:start
pnpm db:env        # Genera .env.local con credenciales locales y CRON_AUTH_SECRET.
# Si ya existe, conservarlo y configurar los valores manualmente.
pnpm dev
```

App: http://localhost:3005. Supabase API: 55321. PostgreSQL: 55322. Studio: http://localhost:55323. Correo local: 55324. Crear un usuario confirmado desde Auth en Studio; no hay credenciales predeterminadas ni registro público. Ingresar, crear una cuenta y enviar un trabajo. El worker crea una notificación almacenada y marca el trabajo como completado.

Para procesar manualmente: POST `/api/cron/jobs` con `Authorization: Bearer <CRON_AUTH_SECRET>`. Para programarlo cada minuto, seguir [operación de colas](docs/queues.md).

## Estructura

```text
apps/next/src/         app, components, config, trpc, types, utils, validations
apps/next/supabase/    schemas declarativos, bootstrap, pruebas SQL, configuración, scheduler
packages/types/       tipos compartidos y Database generado
packages/utils/       utilidades puras
packages/builders/    constructores de payloads
.agents/skills/       skills por área; AGENTS.md es el índice
.cursor/rules/        reglas y referencias al contrato del repositorio
docs/                 arquitectura y operación
```

`pnpm-workspace.yaml` admite sdk/* cuando exista un consumidor. No se incluyen módulos de negocio sin requisitos de Cofar.

## Verificación

```sh
pnpm check          # con entorno configurado: lint, boundaries, tipos, tests, build
pnpm db:test        # PostgreSQL real: RLS, idempotencia, leases y DLQ
pnpm db:types       # regeneración atómica de tipos desde Supabase local
pnpm e2e            # flujo real de login, cuenta, cola y logout
pnpm check-format
```

`pnpm db:reset` borra datos solamente del Supabase local. No ejecutarlo sobre datos locales que deban conservarse. Tests e2e requieren .env.local y crean/eliminan su usuario temporal; nunca deben apuntar a producción.

## Entornos y despliegue

Crear o elegir un proyecto Supabase de Cofar, configurar sus URLs de Auth y aplicar estas migraciones desde la CLI usando ese project-ref. La configuración local por sí sola no crea un proyecto alojado. No reutilizar credenciales de otro entorno.

En Vercel seleccionar el monorepo con el proyecto Next de apps/next y ejecutar el build desde la raíz con `pnpm build`. Configurar las variables de `.env.template` en el entorno de despliegue; en local se leen desde `.env.local`. Next valida las variables públicas antes del build y el entorno completo del servidor al iniciar. SUPABASE_SERVICE_ROLE_KEY y CRON_AUTH_SECRET permanecen privados. Reiniciar procesos tras rotar secretos.

Configurar Vault y ejecutar schedule.sql después de tener la URL de la app. No programar workers contra localhost desde una base remota. `pnpm start` sirve el build para despliegues Node convencionales.

Referencias oficiales: [Next](https://nextjs.org/docs/app), [tRPC](https://trpc.io/docs), [Supabase Queues](https://supabase.com/docs/guides/queues), [Turborepo](https://turbo.build/repo/docs). Versiones fijadas consultadas en el registro npm el 17/09/2026.
