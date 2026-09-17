# Decisiones

> Nota: escribí esto en español para facilitar lectura. El estándar es el inglés
> y el repo está así (código, documentación técnica y ADR)

## De dónde salió esto

Una aclaración de entrada, porque cambia cómo se lee el alcance: quizás parezca mucho el workspace, pero lo pensé basandome en la reu que tuvimos, quería algo que escale y estandarice problemas que me imaginaba que quizás tenían. El repo tiene pnpm con Turborepo, Next App Router, tRPC y Supabase, con autenticación, RLS por cuenta (lo hice multitenant para que escale), una cola PGMQ con su worker, lint, formato, tests y CI. Está todo en el commit inicial del repo.

## El stack

Postgres hace casi todo el trabajo pesado acá. Los dos
perfiles se separan con RLS, las transiciones válidas viven en una función, los
plazos se calculan en SQL y el worker lo dispara `pg_cron` contra una ruta
autenticada de Next. Sin un segundo datastore ni un servicio aparte. Para una
mesa de ayuda de una organización de 800 personas eso alcanza tranquilo.

tRPC porque quiero que el tipo del endpoint sea el mismo que consume el
componente, sin generar nada en el medio. Next App Router porque las páginas son
composición y la autorización se resuelve en el servidor antes de renderizar.

La pregunta obvia es por qué no una API aparte con su propio ORM. Podría, y en
otro contexto lo haría. Acá cada capa que agrego entre el navegador y la tabla es
una capa más donde las reglas de acceso se pueden contradecir entre sí. Con la
regla en la política RLS, si el router se equivoca la base igual dice que no.

## Modelo de datos

Seis tablas nuevas aparte de las básicas (`accounts`, `profiles`,
`users_by_accounts` y las de la cola de trabajos).

`tickets` es el estado actual: quién pidió, quién atiende, categoría, prioridad,
estado y los seis timestamps del SLA (vencimiento, cumplimiento e incumplimiento,
para primera respuesta y para resolución). Los plazos se guardan en la fila en
lugar de calcularse al leer, porque dependen de las jornadas del equipo en el
momento en que se creó el ticket. Si alguien cambia su horario mañana, el
compromiso de ayer se queda donde estaba. De paso la cola puede ordenar y
filtrar por vencimiento con un índice.

`ticket_events` es append only. Cada cambio escribe una fila con actor, valor
anterior, valor nuevo y un `detail` con la evidencia. Podría haber derivado la
historia de la fila del ticket y me ahorraba una tabla, pero la fila miente por
omisión: cuando un ticket se reabre se limpia `resolved_at` y la resolución
anterior desaparece. El evento se queda. Esa es toda la trazabilidad que pide el
punto 3 del enunciado. PD: esto me toco verlo de primera mano, por lo que fue fácil atajarlo

`ticket_agents` define quién es agente, y la fila entera hace de rol. Lo primero
que se me ocurrió fue agregar `agent` al check de `users_by_accounts.role`, que
es una línea de SQL y listo. No terminó siendo eso porque lo que define a un
agente acá es la jornada: días, horario, huso, tope de tickets abiertos y
categorías que cubre. Si eso vive en la tabla de membresías, me quedan ocho
columnas nullables para todo el mundo, incluida la gente que solo abre tickets.

`ticket_categories` y `ticket_category_rules` van separadas porque las reglas se
afinan seguido y las categorías casi nunca. Y las reglas son filas en vez de
constantes en el código por lo mismo: cambiar un término no debería ser un
deploy.

`sla_policies` con clave `(account_id, priority)`. La promesa pertenece a la
prioridad, y la categoría solo decide qué prioridad aplica. Si mañana quiero
prometer distinto por categoría, agrego una columna opcional y la política sigue
siendo el lugar donde se mira.

Dos detalles chicos que igual cuentan: todas las tablas hijas llevan su propio
`account_id` para que la política RLS sea una comparación directa en vez de un
join, y las claves foráneas de personas apuntan a `profiles` en lugar de
`auth.users` para que PostgREST pueda traer el nombre embebido en la misma
consulta.

## Máquina de estados

| Desde         | Con qué                               | Hacia         |
| ------------- | ------------------------------------- | ------------- |
| `new`         | un agente lo toma, o lo rutea el cron | `assigned`    |
| `assigned`    | el agente empieza a trabajar          | `in_progress` |
| `assigned`    | el agente lo resuelve derecho         | `resolved`    |
| `in_progress` | el agente lo resuelve                 | `resolved`    |
| `resolved`    | el solicitante o el agente confirma   | `closed`      |
| `resolved`    | el solicitante o el agente lo reabre  | `in_progress` |

Cinco estados, y el porqué de cada corte:

`new` va separado de `assigned` porque la cola es el producto. El número de
tickets sin asignar es el que te dice si el equipo está desbordado, y si mezclo
los dos estados ese número deja de existir. Tomar un ticket es la única salida
de `new`, con la fila bloqueada, así que dos agentes que hacen clic al mismo
tiempo no se pisan: el segundo recibe `false` y la interfaz le avisa que ya se
lo llevaron.

`assigned` va separado de `in_progress` porque la asignación puede ser
automática y empezar a trabajar no. Esa diferencia es la que hace honesto el SLA
de primera respuesta: el cron te puede asignar el ticket a las tres de la
mañana, y el reloj sigue corriendo hasta que una persona lo toca.

`resolved` va separado de `closed` porque el que decide que algo está resuelto es
el que lo pidió. El agente propone, el solicitante confirma o reabre. Es el único
permiso de escritura que tiene un solicitante sobre el ticket, y evita el caso
clásico de soporte cerrando cosas que siguen rotas.

No hay `cancelled`. Un ticket cancelado es uno resuelto con un motivo, y como en
esta versión no hay comentarios ni motivos de cierre, el estado guardaría menos
información que la bitácora. Preferí dejarlo para cuando haya dónde escribir el
porqué.

Las transiciones válidas están en `set_ticket_status`, y la interfaz solo ofrece
los botones que la base va a aceptar, con la misma tabla copiada en
`ticket.view.utils.ts`. Sí, está duplicado. Lo anoté en la lista de deuda.

## Cómo se reparte la cola

El cron toma los tickets sin asignar y, para cada uno, busca quién puede
atenderlo: agente disponible, dentro de su horario en su propio huso, por debajo
de su tope de tickets abiertos y que cubra esa categoría (sin categorías
cargadas significa que cubre todas).

Entre los que quedan, el ticket va al que está más vacío en relación con su
propio tope, y recién si hay empate al que hace más tiempo que no recibe nada.
Primero lo tenía al revés, con la rotación por tiempo adelante, y el resultado
era injusto: si el agente al que le tocaba por turno ya tenía cuatro tickets
abiertos y otro que cubría la misma categoría estaba libre, el quinto igual le
caía al primero. La rotación quedó como desempate, que es donde sirve.

Lo mido en proporción y no en cantidad porque los topes son de cada persona.
Alguien con tope 10 y cuatro abiertos tiene más lugar que alguien con tope 5 y
cuatro abiertos, aunque los dos muestren el mismo número.

Cuando nadie cumple las condiciones, el ticket no se fuerza ni se pierde: se
queda en la cola con su reloj de SLA corriendo, y la corrida siguiente lo toma
en cuanto alguien resuelve algo y libera lugar. Eso también es un mensaje para
el equipo: si la cola crece y nadie tiene lugar, el problema es de capacidad y
el tablero lo muestra en "sin asignar" y en "vencidos".

## Alcance opcional

Elegí SLA por prioridad y categorización automática, que son las dos que
convierten una lista de tickets en un sistema: una decide cuándo hay que
responder y la otra ordena lo que entra sin que alguien lo mire primero.

Sobre la categorización hay un detalle de producto que cambié sobre la marcha.
Al principio el formulario ofrecía "detectar automáticamente" como opción del
desplegable, y eso confunde: quien pide no elige un algoritmo, elige una
categoría. Ahora la elige siempre, y las reglas corren igual como segunda
opinión: si no coinciden, el ticket guarda el desacuerdo en la bitácora y el
agente decide. El clasificador queda como único responsable cuando no hay nadie
que elija, que es el caso de lo que entra por otro canal. Están explicadas en
detalle en [docs/tickets.md](docs/tickets.md).

Entraron además búsqueda con filtros y tablero de métricas, aunque no como una
tercera y cuarta elección. Leen columnas que la mesa ya mantiene para otra cosa
y salieron casi gratis: los filtros son condiciones sobre índices que ya
existían y el tablero es una función SQL con contadores.

Lo que quedó afuera, con el criterio de cada uno:

**Adjuntos.** El bucket privado ya está en el workspace, así que el archivo no
es el problema. El problema es lo otro: límites de tamaño, qué hacés con un
ejecutable, quién puede ver el archivo de un ticket que se reasignó. Es una
tarde de decisiones de seguridad que no cambian cómo se rutea ni cómo se mide.

**Notificaciones.** Necesitan un proveedor de correo y una clave de idempotencia
en el destino para que un reintento no mande el mismo aviso dos veces. Este
workspace no tiene credenciales de correo y no quise inventarle una. Los
vencimientos igual aparecen en la cola, en la bitácora y en el tablero.

**Comentarios.** Duplican la superficie de RLS, porque un comentario público lo
ve el solicitante y una nota interna no, y eso es una política más y un test más
por cada caso. A cambio no cambian ni el ruteo ni las métricas.

**Reasignación.** Con una sola cola y autoservicio para tomar, es un caso de
borde. Además en cuanto la agregás aparece la pregunta de quién puede reasignar
a quién, que es una jerarquía de equipos que esta versión no tiene.

El criterio, resumido: me quedé con lo que cambia cómo se rutea o cómo se mide
el trabajo, y dejé afuera lo que solo agrega superficie.

## Si esto tuviera que escalar a 50.000 tickets por mes y 5 áreas

50.000 por mes son unos 1.700 por día, unos 2 por minuto en horario laboral. No
es un volumen enorme, igual hay cosas que romperían antes de llegar ahí.

**El worker de un minuto con lote de 25.** A dos por minuto sobra, pero un pico
lo pasa por arriba: si se cae el correo de la empresa y entran 400 tickets en
diez minutos, la cola drena de a 25 y el último espera un cuarto de hora por una
asignación que no depende de nada. Movería el ruteo a la misma transacción que
crea el ticket, que ya tiene la fila bloqueada, y dejaría el cron para el
barrido de SLA y para reintentar lo que no encontró agente.

**Cinco áreas no entran en este modelo.** Hoy la taxonomía es plana y hay una
cola por cuenta. Cinco áreas necesitan una tabla intermedia, con ruteo por área,
SLA por área (la promesa de RRHH no tiene por qué ser la de sistemas) y métricas
por área. El `category_ids` del agente es una versión pobre de eso, y lo
reemplazaría en vez de estirarlo.

**El tablero hace un scan completo por visita.** `ticket_metrics` calcula
diecisiete agregados sobre toda la tabla cada vez que alguien abre la página.
Con 600.000 tickets al año eso se empieza a sentir. Precalcularía cortes diarios
en una tabla de rollups, escrita por el mismo cron, y dejaría en vivo solo los
contadores chicos: abiertos, sin asignar y vencidos. O si escala más hasta haría un sistema con tinybird para consumir y agregar más fácil

**La cola trae 100 filas sin paginar.** Paginación por keyset sobre
`(priority, created_at, id)`, y el conteo total aparte, porque un `count(*)`
sobre la tabla entera en cada tecleo de búsqueda no aguanta.

**El clasificador por reglas se vuelve inmantenible a mano.** Con ese volumen
nadie va a estar agregando términos de a uno. Ahí es donde sirve haber guardado
cada corrección de agente con la fuente y la confianza previas: primero mediría
precisión por categoría con esos datos, y recién después elegiría entre minar
términos nuevos de las correcciones o pasar a embeddings con las reglas de
respaldo. El motor está detrás de una sola llamada en `tickets.create`, así que
cambiarlo sale barato. Lo que no quiero es cambiarlo a ciegas.

**El polling cada 15 segundos.** Con cinco áreas y decenas de agentes mirando la
cola son muchas consultas por minuto para enterarse de que no cambió nada. Las
tablas ya están en la publicación de realtime, así que la cola pasaría a
suscripción y el polling quedaría de respaldo.

**Un índice para el barrido.** Hoy `sweep_ticket_sla` filtra por vencimiento y
estado sin un índice parcial que lo acompañe. A este volumen da igual, a 600.000
filas no.

## Deuda técnica que asumí a propósito

1. **El número de ticket es una identidad global.** Es único, pero no correlativo
   por cuenta, así que dos organizaciones ven saltos en su numeración y de paso
   se filtra el volumen total. Se arregla con un contador por cuenta, que es una
   fila más y un bloqueo por inserción.
2. **La tabla de transiciones existe dos veces**, en `set_ticket_status` y en
   `ticket.view.utils.ts`. La de SQL es la que manda y la de la interfaz solo
   decide qué botones dibujar, igual se pueden separar con el tiempo. En otro
   proyecto lo resolví proyectando las dos desde una sola fuente, acá no llegué.
3. **La asignación automática asume un solo worker corriendo.** Bloqueo la fila
   del ticket, así que no se asigna dos veces, pero dos corridas en paralelo
   pueden pasarse del tope de tickets abiertos de un agente. Con
   `FOR UPDATE SKIP LOCKED` sobre la fila del agente se cierra.
4. **Las reglas del clasificador las lee cualquier integrante de la cuenta**,
   porque corren con el cliente del solicitante. Alguien podría escribir su
   ticket para caer en la categoría que quiere. Lo dejé así porque el agente
   corrige y la corrección queda registrada, pero fue una decisión y no un
   olvido.
5. **`update_agent_shift` pisa la jornada entera.** Dos ediciones simultáneas del
   mismo agente terminan con la última escritura ganando, sin bloqueo optimista.
6. **El huso horario del agente es texto libre.** `safe_timezone` lo valida
   contra Postgres y cae a UTC si no existe, en silencio. Debería avisar.
7. **El seed de demo no es idempotente.** Corrido dos veces crea dos cuentas.
   Sirve para mostrar el producto, no es una fixture.
8. **No hay motivo de cierre.** Sin comentarios ni motivos, la pregunta de por
   qué se cerró un ticket no tiene dónde vivir salvo en el título. Esto lo hice obligatorio en otro proyecto que desarrollé algo similar

## Autenticación y despliegue

Autenticación real de Supabase con correo y contraseña, con el registro público
cerrado. El alta que se usa en la mesa es la pantalla de equipo: el
administrador pone nombre, correo y contraseña y `agents.create` arma el login.
Sigue existiendo `invite_account_member` para sumar a alguien que ya tiene
cuenta; esa vía no manda correo, resuelve el usuario por email. Para probarlo,
`pnpm demo:seed` crea tres usuarios, uno por perfil.

Corre local con la CLI de Supabase. Para desplegarlo falta un proyecto Supabase,
un proyecto en Vercel apuntando a `apps/next`, las variables de `.env.template` y
los dos secretos de Vault que usa `schedule.sql` para el cron. No lo desplegué
porque este workspace no tiene credenciales de ningún entorno y no quería
inventar ninguna.
