import { LoginForm } from "@/components/auth/LoginForm/LoginForm";

const Login = () => {
  return (
    <main className="mx-auto max-w-md px-6 py-20">
      <p className="brand">
        cofar<span className="brand-plus">+</span>
      </p>
      <p className="brand-sub mb-8">soporte</p>
      <div className="card">
        <h1 className="mb-6 text-2xl font-semibold">Ingresar</h1>
        <LoginForm />
      </div>
    </main>
  );
};

export default Login;
