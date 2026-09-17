# Cofar

Configuración: [entorno y Zod](docs/environment.md). Skills y reglas: [AGENTS.md](AGENTS.md).

Turborepo con pnpm, Next App Router, tRPC, React Query, Tailwind 4 y Supabase (Auth, PostgreSQL/RLS, Storage, Realtime, PGMQ y Cron).

## Mesa de ayuda

Sistema de tickets para reemplazar el correo y las planillas: quién pidió qué,
quién lo tiene, cuánto demora y qué pasó con cada solicitud.

Dos perfiles sobre la misma cuenta. El **solicitante** es cualquier integrante:
crea tickets y ve solamente los suyos. El **agente** es quien tiene jornada
cargada en `ticket_agents`: ve la cola completa, toma tickets y los mueve. El
**administrador** del espacio da de alta a las personas con su contraseña y,
si son agentes, les carga el turno y las categorías que van a atender. La
separación la aplican las políticas RLS, así que no depende de que la interfaz
esconda un botón.

Estados: `en cola → asignado → en curso → resuelto → cerrado`, con reapertura
desde resuelto. Tomar un ticket es la única salida de la cola, y el solicitante
solo confirma o reabre la resolución de sus propios tickets. Cada cambio deja un
evento inmutable con actor, valor anterior, valor nuevo y evidencia.

Las dos piezas elegidas del alcance opcional:

- **Categorización automática.** Reglas de términos con peso por cuenta y un
  clasificador determinístico (`packages/utils`). Quien pide elige la categoría,
  y las reglas corren igual: si no coinciden, el ticket guarda el desacuerdo en
  la bitácora para que el agente lo resuelva. Para lo que entra sin nadie que
  elija (otro canal, una API) el clasificador asigna la categoría, y si no llega
  a 4 puntos, no concentra el 55% de la evidencia o empata, queda en
  `Sin clasificar`. La categoría fija la prioridad y la prioridad fija el SLA.
  Cada corrección de un agente queda registrada.
- **SLA por prioridad.** Compromisos de primera respuesta y resolución por
  prioridad. El reloj no corre 24/7: las jornadas son de cada agente, así que el
  plazo avanza sobre la unión de los turnos del equipo, cada uno en su huso. El
  cron marca los vencimientos y los deja en la bitácora y en el tablero.

Se sumaron búsqueda, filtros y tablero de métricas porque leen columnas que la
mesa ya mantiene. Quedaron afuera adjuntos, notificaciones por correo,
comentarios y reasignación.

Para el ejercicio, tres documentos aparte: [DECISIONS.md](DECISIONS.md) con el
modelo de datos, los estados, lo que descarté y qué rompería a 50.000 tickets
por mes; [QUALITY.md](QUALITY.md) con qué probé, qué no y por qué; y
[AI-USAGE.md](AI-USAGE.md) con cómo trabajé con los agentes. El detalle técnico
está en [mesa de ayuda](docs/tickets.md), las decisiones de arquitectura en
[ADR 0002](docs/adr/0002-support-desk.md) y la operación del worker en
[colas](docs/queues.md).

## Correrlo en local

Requisitos: Node 24, Corepack y Docker. La versión de pnpm está fijada en
package.json.

Desde un clone limpio, o si borraste el Supabase local:

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm db:start      # Docker: Postgres, Auth, Studio
pnpm db:env        # Crea apps/next/.env.local; no pisa uno que ya exista
pnpm demo          # Reset de la base local + usuarios y tickets de prueba
pnpm dev
```

Si `.env.local` quedó de un Supabase anterior, borralo y volvé a correr
`pnpm db:env`. Las claves JWT cambian al recrear los volúmenes.

App: http://localhost:3005. API: 55321. Postgres: 55322. Studio: 55323.

`pnpm demo` imprime las credenciales (contraseña `cofar1234` para los tres):

- `admin@cofar.test` — administrador y agente
- `agente@cofar.test` — agente
- `solicitante@cofar.test` — solicitante

No hay registro público. `pnpm db:reset` solo vacía la base local; después hace
falta `pnpm demo:seed` (o otra vez `pnpm demo`).

Para forzar el worker de la mesa, con `CRON_AUTH_SECRET` de
`apps/next/.env.local`:

```sh
curl -X POST http://localhost:3005/api/cron/tickets \
  -H "Authorization: Bearer $CRON_AUTH_SECRET"
```

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
pnpm e2e            # login, ciclo del ticket y worker de la mesa
pnpm check-format
```

El esquema declarativo de `supabase/schemas/` es la fuente. Los cambios se
escriben ahí y la migración se genera con
`pnpm --filter @cofar/next exec supabase db diff -f <nombre>`, revisando la
salida: el diff no emite privilegios de funciones ni publicaciones, así que esa
parte se agrega a mano al final del archivo.

`pnpm db:reset` borra datos solamente del Supabase local. No ejecutarlo sobre datos locales que deban conservarse. Tests e2e requieren .env.local y crean/eliminan su usuario temporal; nunca deben apuntar a producción.

## Entornos y despliegue

Crear o elegir un proyecto Supabase de Cofar, configurar sus URLs de Auth y aplicar estas migraciones desde la CLI usando ese project-ref. La configuración local por sí sola no crea un proyecto alojado. No reutilizar credenciales de otro entorno.

En Vercel seleccionar el monorepo con el proyecto Next de apps/next y ejecutar el build desde la raíz con `pnpm build`. Configurar las variables de `.env.template` en el entorno de despliegue; en local se leen desde `.env.local`. Next valida las variables públicas antes del build y el entorno completo del servidor al iniciar. SUPABASE_SERVICE_ROLE_KEY y CRON_AUTH_SECRET permanecen privados. Reiniciar procesos tras rotar secretos.

Configurar Vault y ejecutar schedule.sql después de tener la URL de la app. No programar workers contra localhost desde una base remota. `pnpm start` sirve el build para despliegues Node convencionales.

Referencias oficiales: [Next](https://nextjs.org/docs/app), [tRPC](https://trpc.io/docs), [Supabase Queues](https://supabase.com/docs/guides/queues), [Turborepo](https://turbo.build/repo/docs). Versiones fijadas consultadas en el registro npm el 17/09/2026.
