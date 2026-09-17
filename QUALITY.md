# Estrategia de calidad

> Nota: escribí esto en español, que es como lo pienso. El estándar es el inglés
> y el repo está así (código, documentación técnica y ADR), así que si les sirve
> más en inglés lo traduzco sin drama.

## El criterio

Puse el esfuerzo donde el fallo es silencioso. Si un botón no anda, alguien me
avisa en cinco minutos y lo arreglo. Si un solicitante puede leer los tickets de
otro, o si el reloj del SLA cuenta las noches y los domingos, eso no lo reporta
nadie, y para cuando lo descubrís ya tenés meses de números mal.

Así que el orden quedó más o menos así: permisos y aislamiento entre cuentas, la
máquina de estados, la matemática del SLA, el worker que corre sin que nadie lo
mire, y al final la interfaz.

## Qué probé

**pgTAP contra Postgres real, 58 pruebas** (`pnpm db:test`), 40 de la mesa de
ayuda. Es el nivel que más cuido, porque son garantías de la base y mockearlas no
prueba gran cosa. Cubre que un solicitante solo vea sus tickets y un agente la
cola entera, que otra cuenta no vea nada, que escribir `tickets` directo por
PostgREST falle, que dos agentes tomando el mismo ticket dejen un solo ganador,
que las transiciones inválidas exploten con su código de error, que el ruteo
respete turno y tope de carga, que el barrido marque cada meta una sola vez, y
que un plazo que arranca un viernes a la noche caiga el lunes a la mañana.

Un archivo aparte, `routing.test.sql`, sigue el reparto paso a paso con dos
agentes de tope dos: el primero entra al que está libre, el segundo al colega
vacío, el tercero desempata por antigüedad, el quinto no entra en ningún lado y
queda en la cola, y vuelve a entrar en cuanto uno resuelve algo. Ahí mismo
compruebo que las métricas devuelven los mismos números que la tabla y que quien
pide sigue viendo solo lo suyo.

**Vitest sobre lógica pura, 29 pruebas** (`pnpm test`), 13 de la mesa. El
clasificador con sus casos incómodos: acentos, el título pesando doble, un
término de dos palabras ganándole al que lo contiene ("licencia médica" contra
"licencia"), un empate que queda sin clasificar y evidencia débil que también.
El semáforo del SLA. La tabla de transiciones de la interfaz, que está probada
justamente para que se note si se separa de la de SQL. El nombre de cada perfil
en la navegación. Y el bucle del worker con un cliente falso, para la parte que
no es SQL: que no vuelva a preguntar por una ruta donde ya sabe que nadie puede
tomar.

**Componentes, 11 pruebas** (`pnpm test:components`), solo donde hay ramas: qué
badges salen, cuándo aparece el botón de tomar y cuándo no. Maquetación no
probé, porque el diseño no se evalúa acá y los snapshots de layout se rompen
cada vez que movés un margen, que es bastante mantenimiento a cambio de poco.

**Playwright, 13 pruebas** en cuatro archivos (`pnpm e2e`). Uno crea un espacio
desde las cajas y comprueba que la cola de trabajos sigue funcionando. Otro
recorre el ciclo completo con dos sesiones de navegador en paralelo, solicitante
y agente, desde crear hasta cerrar. El tercero da de alta un agente con su
contraseña desde la pantalla de equipo y verifica que esa persona puede entrar y
abrir la cola, y es el que más atención le dedica al worker: rutea contra
el agente en turno y verifica que el reloj de primera respuesta siga corriendo,
lo deja en cola cuando el agente se marca ocupado desde la interfaz, marca los
vencimientos una sola vez y los pinta en rojo en la cola, y revisa el contrato
HTTP completo (401 sin secreto, 400 con JSON roto, 422 con un campo de más, 200
con las cinco claves del resultado).

El cuarto archivo recorre el reparto con dos agentes: un pedido creado desde la
pantalla llega solo a un agente por el cron, cuatro pedidos quedan dos y dos, el
quinto espera en la cola hasta que alguien resuelve, el tablero muestra los
mismos números que la tabla, y cada perfil llega solo a lo suyo (quien pide no
ve el ticket de otra persona ni entra a la cola, a las métricas o al equipo; el
agente ve la cola completa pero no el alta de personas).

Todo eso corre en CI. `pnpm check` no necesita base y hace lint, límites de
importación entre paquetes, tipos, tests y build. `pnpm db:test` y `pnpm e2e`
levantan Supabase local.

## Qué no probé

**El scheduler de `pg_cron`.** Registrar los jobs necesita los secretos en Vault
y crea tareas reales cada minuto, así que `schedule.sql` quedó verificado a mano
y documentado como paso de operador en [docs/queues.md](docs/queues.md). Lo que
sí está probado es la ruta que el cron invoca, que es donde puede haber un bug de
verdad.

**El resto de los números del tablero.** Abiertos, sin asignar y vencidos
coinciden con la tabla (pgTAP y e2e). No cubrí cumplimiento de SLA, promedio de
resolución ni los cortes por estado, prioridad y categoría. Son informativos y
no disparan ruteo; si empezaran a hacerlo, irían a pgTAP.

**Promover o sacar a un agente que ya es integrante.** El alta con contraseña
desde la pantalla de equipo está en el e2e: crea el acceso, entra y abre la
cola. No cubrí el toggle de `setAgent` en la interfaz, ni el rechazo de sacar a
alguien que todavía tiene tickets abiertos.

**Volumen.** No hay pruebas de carga ni de performance. A la escala del enunciado
me parecía prematuro, y lo que espero que rompa primero está escrito en
[DECISIONS.md](DECISIONS.md) para no tener que adivinarlo después.

**Accesibilidad más allá de etiquetas y roles.** Los tests usan localizadores
accesibles, así que si un campo se queda sin `label` el test se cae, pero no
corrí ninguna auditoría.

**El cambio de cuenta activa** cuando alguien pertenece a más de una, que es el
caso menos frecuente y el más aburrido de montar.

## Qué encontraron los tests

Esto es lo que justifica el reparto, así que lo dejo explícito.

El e2e del ciclo completo encontró que el aviso de categoría decía "Sin
clasificar" aunque la clasificación había funcionado bien: la interfaz buscaba el
nombre por su cuenta en vez de leer lo que se había guardado. Se arregló
devolviendo el resultado persistido desde el RPC, que además evita que el aviso y
la base puedan decir cosas distintas.

El mismo e2e, por un warning de claves repetidas en React, destapó que la
consulta de membresías traía las de todos los integrantes de la cuenta y no las
de quien mira. Duplicaba la cuenta en el selector y, peor, podía tomar el rol de
otra persona para decidir si sos dueño.

`pnpm db:test` detectó que la migración generada por `supabase db diff` no emite
los privilegios de las funciones ni los `revoke` de las tablas, así que aplicando
solo esa migración los RPC quedaban ejecutables por cualquiera y `authenticated`
conservaba el `update` sobre `tickets`. El test que lo atrapó comprueba que un
solicitante no pueda forjar una resolución escribiendo la tabla directo.

Los tres se veían igual de bien en pantalla, que es más o menos el argumento
entero de por qué el esfuerzo fue para ese lado.

El e2e de visibilidad encontró otra de paso: al abrir el ticket de otra persona,
la pantalla tardaba siete segundos en decir que no existe, porque React Query
reintentaba tres veces un error que nunca iba a cambiar. Ahora un
`NOT_FOUND`, un `FORBIDDEN` o un `UNAUTHORIZED` se muestran de una.

Y el reverso, que es igual de útil: el formulario de jornada mostraba todos los
días de trabajo destildados aunque estuvieran guardados, porque react-hook-form
compara el valor del checkbox como texto y la base los devuelve como números. El
envío mandaba los días correctos, así que ni el test de componentes ni el e2e lo
notaron. Ese lo encontré mirando una captura, que es exactamente el tipo de error
que decidí no cubrir con tests y sigo pensando que está bien así.
