import Link from "next/link";

const Home = () => {
  return (
    <main className="mx-auto max-w-4xl px-6 py-20">
      <p className="brand">
        cofar<span className="brand-plus">+</span>
      </p>
      <p className="brand-sub">soporte</p>
      <h1 className="mt-10 text-5xl font-semibold">
        Una mesa de ayuda con tiempos que se cumplen.
      </h1>
      <p className="my-8 max-w-xl text-lg text-muted">
        Cada solicitud entra con categoría y prioridad, se reparte entre los
        agentes que están de turno y deja registro de todo lo que le pasó.
      </p>
      <div className="flex flex-wrap gap-3">
        <Link href="/tickets" className="button inline-block">
          Abrir la mesa de ayuda
        </Link>
        <Link href="/dashboard" className="button button-ghost inline-block">
          Ver mis espacios
        </Link>
      </div>
      <dl className="mt-14 grid gap-4 sm:grid-cols-3">
        <div className="card">
          <dt className="font-semibold text-navy">Solicitante</dt>
          <dd className="mt-2 text-sm text-muted">
            Crea su pedido, elige la categoría y sigue el estado hasta el
            cierre.
          </dd>
        </div>
        <div className="card">
          <dt className="font-semibold text-navy">Agente</dt>
          <dd className="mt-2 text-sm text-muted">
            Trabaja una cola con filtros, toma lo que le toca y mueve el estado.
          </dd>
        </div>
        <div className="card">
          <dt className="font-semibold text-navy">Administrador</dt>
          <dd className="mt-2 text-sm text-muted">
            Da de alta agentes, define sus turnos y mira el cumplimiento del
            SLA.
          </dd>
        </div>
      </dl>
    </main>
  );
};

export default Home;
