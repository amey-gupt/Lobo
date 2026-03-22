import * as React from "react";
import ProvidersClient from "./providers-client";

export function RootProviders({ children }: { children: React.ReactNode }) {
  return <ProvidersClient>{children}</ProvidersClient>;
}
