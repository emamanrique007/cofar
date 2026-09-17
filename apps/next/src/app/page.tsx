import Link from "next/link";

const Home = () => {
  return (
    <main className="mx-auto max-w-4xl px-6 py-24">
      <p className="text-sm font-bold tracking-widest">COFAR</p>
      <h1 className="mt-8 text-5xl font-semibold">
        Una base para trabajar juntos.
      </h1>
      <p className="my-8 max-w-xl text-lg text-slate-600">
        Tu espacio de trabajo, con acceso seguro y procesos en segundo plano.
      </p>
      <Link href="/dashboard" className="button inline-block">
        Abrir mi espacio
      </Link>
    </main>
  );
};

export default Home;
