import { useEffect } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import CommandPaletteDialog from "./studio-core/CommandPaletteDialog";
import { SelectionProvider } from "./context/SelectionContext";
import { ensureDefaultPanelLayouts } from "./utils/layoutStorage";

import CoSimStudioPage from "./pages/CoSimStudioPage";
import COAsPage from "./pages/COAsPage";
import CausalPage from "./pages/CausalPage";
import EvaluationPage from "./pages/EvaluationPage";
import MapPage from "./pages/MapPage";
import ModulesPage from "./pages/ModulesPage";
import OverviewPage from "./pages/OverviewPage";
import ReasonWorkspacePage from "./pages/ReasonWorkspacePage";
import Replay3DPage from "./pages/Replay3DPage";
import RealismPage from "./pages/RealismPage";
import RunsPage from "./pages/RunsPage";

export default function App() {
  useEffect(() => {
    ensureDefaultPanelLayouts();
  }, []);

  return (
    <SelectionProvider>
      <CommandPaletteDialog />
      <Routes>
        <Route path="/" element={<Navigate to="/mission" replace />} />

        <Route path="/mission" element={<OverviewPage />} />
        <Route path="/reason" element={<ReasonWorkspacePage />} />
        <Route path="/decide" element={<COAsPage />} />
        <Route path="/build" element={<ModulesPage />} />
        <Route path="/replay" element={<OverviewPage />} />
        <Route path="/validation" element={<EvaluationPage />} />

        <Route path="/overview" element={<OverviewPage />} />
        <Route path="/map" element={<MapPage />} />
        <Route path="/coas" element={<COAsPage />} />
        <Route path="/causal" element={<CausalPage />} />
        <Route path="/realism" element={<RealismPage />} />
        <Route path="/evaluation" element={<EvaluationPage />} />
        <Route path="/modules" element={<ModulesPage />} />
        <Route path="/runs" element={<RunsPage />} />
        <Route path="/cosim" element={<CoSimStudioPage />} />
        <Route path="/replay-3d" element={<Replay3DPage />} />
      </Routes>
    </SelectionProvider>
  );
}
