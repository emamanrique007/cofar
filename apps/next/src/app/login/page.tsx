import { LoginForm } from "@/components/auth/LoginForm/LoginForm";

const Login = () => {
  return (
    <main className="mx-auto max-w-md px-6 py-20">
      <h1 className="mb-8 text-3xl font-semibold">Ingresar a Cofar</h1>
      <LoginForm />
    </main>
  );
};

export default Login;
