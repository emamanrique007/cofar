import type { Metadata } from "next";
import type { ReactNode } from "react";

import { Providers } from "@/components/global/Providers/Providers";

import "./globals.css";

export const metadata: Metadata = {
  title: "Cofar",
  description: "Plataforma Cofar"
};

const RootLayout = ({ children }: { children: ReactNode }) => {
  return (
    <html lang="es">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
};

export default RootLayout;
