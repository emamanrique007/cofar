# Uso de IA

> Nota: escribí esto en español para facilitar lectura. El estándar es el inglés
> y el repo está así (código, documentación técnica y ADR)

## Qué usé y para qué

Tres herramientas, y cada una en la parte donde me rinde:

**Codex con Astra 6 para los planes.** Antes de escribir código me sirve para
ordenar el plan: qué tablas, qué endpoints, en qué orden, qué se prueba dónde.
Le pido el plan y lo discuto.

**Claude Code con Opus 5 para construir.** El grueso de la mesa de ayuda salió
de una sesión larga con el plan ya decidido: esquema SQL con sus RPC y políticas,
clasificador, routers de tRPC, componentes, tests de los cuatro niveles y
documentación técnica. Corre los comandos del repo por su cuenta, así que
`pnpm check`, `pnpm db:test` y `pnpm e2e` los ejecuta él y lee los errores él.

**Cursor con Grok 4.6 para lo chico.** Arreglos puntuales y detalles de interfaz.
Para mover un badge o corregir un texto no necesito el modelo grande, y la vuelta
es más rápida.

El repo ya venía preparado para trabajar así (tenía prepensada la estructura), y eso pesa más que el modelo que
elijas.

## Cómo está estructurado el contexto

`AGENTS.md` es el contrato del workspace y `CLAUDE.md` no hace más que
importarlo, así que hay una sola fuente y no dos que se contradicen. Adentro hay
una tabla que rutea por área: para tocar SQL, la skill `supabase`; para el
worker, `queues`; para endpoints y páginas, `next-trpc`; para tests y CI,
`quality`. La regla es leer solo la skill de la tarea en curso.

Eso es a propósito. Si le doy 3.000 líneas de convenciones antes de empezar, no
las va a seguir mejor, las va a diluir. Prefiero un índice corto y skills
específicas cerca de lo que tocan.

Las dos que más revisión me ahorran son de convención pura:
`single-line-call-params` (nada de objetos multilínea como argumento, los tipos
con nombre van en `*.types.ts`) y `no-compat-re-exports` (prohibido dejar
barriles de compatibilidad cuando movés algo a utils). Son detalles chicos que
los agentes hacen distinto cada vez, y sin la regla escrita terminás con un PR
lleno de comentarios de estilo.

Las skills descargadas están fijadas por hash en `skills-lock.json` para que no
cambien abajo mío.

Abajo de todo eso hay dos redes que no dependen del agente: `pnpm check` corre
lint, límites de importación, tipos, tests y build, y `pnpm db:test` corre pgTAP
contra un Postgres real. Si el agente se equivoca, el gate lo dice antes que yo.

## Qué delegué completo

Casi todo el vertical: esquema SQL con sus RPC y políticas RLS, el clasificador
por reglas, los routers de tRPC, los componentes y páginas, los tests y la
documentación técnica. También la ejecución de los gates y la lectura de los
errores.

Lo que no delegué fueron las decisiones de producto y de modelo. Las tres que
definieron el ejercicio las contesté yo antes de que escribiera código: reglas
determinísticas en vez de un modelo para clasificar, horario laboral real en vez
de reloj 24/7, y qué opcionales entraban.

## Dónde tuve que meter mano

**La jornada laboral.** Modeló el
calendario en la cuenta: `accounts.timezone`, `business_days`, `business_start`
y `business_end`. Es lo que hace casi cualquier sistema de tickets, así que se
entiende, pero acá no va: las jornadas son de cada agente. Lo frené con el
esquema ya escrito y aplicado, y el cambio no fue mover cuatro columnas de
tabla. Obligó a que el reloj del SLA pase a ser la unión de los turnos del
equipo, que es un modelo distinto y bastante mejor, y a reescribir la función que
calcula los plazos. Para esto me acordé de hubstaff, suelo hacer ingeniería inversa cuando necesito sacar alguna funcionalidad, busco como la competencia lo hace

**El HTTP sin pasar por el común.** La tendencia de siempre es que cada ruta se
arme su propio parseo del body, su validación y su forma de contestar. Cada ruta
se ve bien sola, y cuando tenés cuatro terminás con cuatro maneras distintas de
devolver un 422. En este repo eso vive en `http.utils.ts` con
`api(request).input(schema).handle(handler)` y los esquemas de entrada salen de
`vCommon.inputs`, así que la ruta nueva del worker quedó igual que la que ya
existía, con el mismo contrato de 400, 401, 422 y 500.

**Los zod quemados.** Las validaciones salieron con los enums escritos a mano,
un `z.enum(["new", "assigned", ...])` con los valores copiados del SQL. Funciona
hasta que alguien agrega un estado en la base y el esquema sigue diciendo lo de
antes, en silencio. Ahora salen de `Constants.public.Enums`, que genera la CLI de
Supabase desde la base, así que si el enum cambia, TypeScript avisa en vez de
dejarlo pasar.

**Los tipos metidos en lugares raros.** Pasó de dos formas. Una, tipos con
nombre declarados dentro de archivos de lógica, que es justo lo que la skill
pide no hacer. La otra más interesante: derivó las filas de las consultas desde
el router con `inferRouterOutputs`, y eso hizo explotar al compilador con "type
instantiation is excessively deep and possibly infinite". Terminamos con formas
explícitas en `*.types.ts` y `returns<T>()` en las consultas, que además es lo
que hay que hacer cuando el `select` de supabase se arma en runtime y el
inferidor no puede leerlo.

**Los checkboxes que mentían.** En el formulario de jornada, los días de
trabajo llegan de la base como números y react-hook-form compara el `value` del
checkbox como texto, así que la pantalla mostraba todos los días destildados
aunque en la base estuvieran de lunes a viernes. Lo peor es que el envío
mandaba los días correctos, o sea que ningún test lo veía: lo encontré mirando
una captura de la pantalla. Es un buen recordatorio de que hay una clase de
error que solo se ve con los ojos.

**El alcance opcional.** Ofreció un clasificador híbrido con Claude por atrás y
caída a reglas si no había clave. Está bien pensado y aun así lo descarté: mete
una dependencia y un secreto para ganar recall que todavía no puedo medir. Con reglas, además, todo el pipeline corre en CI sin red.

## Qué funcionó mejor de lo que esperaba

Que se probara a sí mismo. Los tres bugs reales de la sesión los encontraron los
tests que él mismo escribió, no yo leyendo el diff: el aviso de categoría que
decía "Sin clasificar" cuando la clasificación había funcionado bien, la lectura
de membresías que traía las de todos los integrantes y podía tomar el rol
equivocado, y los privilegios faltantes de la migración generada.

Y cuando algo se cayó, lo dijo. Pegó el error y siguió, sin maquillarlo.

## Qué no le dejaría hacer solo

Decidir el modelo de datos, que es donde el default es más peligroso justamente
porque suena razonable. Y elegir alcance, porque siempre suma: si lo dejás,
terminás con una nave espacial cuando necesitabas una bici
