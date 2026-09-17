import type { NextConfig } from "next";

import { publicEnvVariables } from "./src/config/env.config";

publicEnvVariables.parse(process.env);

const config: NextConfig = {
  transpilePackages: ["@cofar/types", "@cofar/utils", "@cofar/builders"],
  poweredByHeader: false
};

export default config;
