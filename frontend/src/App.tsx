import { useEffect } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { ensureDefaultPanelLayouts } from "./utils/layoutStorage";
import CoSimStudioPage from "./pages/CoSimStudioPage";
import COAsPage from "./pages/COAsPage";
import CausalPage from "./pages/CausalPage";
import MapPage from "./pages/MapPage";
import ModulesPage from "./pages/ModulesPage";
import OverviewPage from "./pages/OverviewPage";
import Replay3DPage from "./pages/Replay3DPage";
import RunsPage from "./pages/RunsPage";

export default function App() {
  useEffect(() => {
    ensureDefaultPanelLayouts();
  }, []);

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/overview" replace />} />
      <Route path="/overview" element={<OverviewPage />} />
      <Route path="/map" element={<MapPage />} />
      <Route path="/coas" element={<COAsPage />} />
      <Route path="/causal" element={<CausalPage />} />
      <Route path="/modules" element={<ModulesPage />} />
      <Route path="/runs" element={<RunsPage />} />
      <Route path="/cosim" element={<CoSimStudioPage />} />
      <Route path="/replay-3d" element={<Replay3DPage />} />
    </Routes>
  );
}
