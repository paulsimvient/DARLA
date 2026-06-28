import type { ReactNode } from "react";
import DataProvenancePanel from "./DataProvenancePanel";
import StatusBar from "./StatusBar";
import TopNav from "./TopNav";

type AppShellProps = {
  children: ReactNode;
  footer?: ReactNode;
  hideStatusBar?: boolean;
};

export default function AppShell({ children, footer, hideStatusBar }: AppShellProps) {
  return (
    <div className="flex h-full flex-col bg-darla-bg">
      <TopNav />
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
      {footer}
      {!hideStatusBar ? <DataProvenancePanel /> : null}
      {!hideStatusBar ? <StatusBar /> : null}
    </div>
  );
}
