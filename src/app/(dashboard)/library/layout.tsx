import { ReactNode } from "react";
import { ManualSearchModalProvider } from "@/ui/components/manual-search-context";

export default function LibraryLayout({ children }: { children: ReactNode }) {
  return <ManualSearchModalProvider>{children}</ManualSearchModalProvider>;
}
