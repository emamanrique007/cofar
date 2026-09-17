import "server-only";
import { envVariables } from "./env.config";

export const getServerEnv = () => {
  return envVariables.parse(process.env);
};
