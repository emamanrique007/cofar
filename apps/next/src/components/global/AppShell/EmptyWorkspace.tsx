import Link from "next/link";

export const EmptyWorkspace = () => {
  return (
    <section className="card">
      <h1 className="mb-2 text-2xl font-semibold">Todavía no tenés espacio</h1>
      <p className="mb-4 text-muted">
        Creá una cuenta de trabajo para abrir la mesa de ayuda. Al crearla se
        cargan las categorías, las reglas de clasificación y los acuerdos de SLA
        por prioridad.
      </p>
      <Link href="/dashboard" className="button inline-block">
        Crear mi espacio
      </Link>
    </section>
  );
};
