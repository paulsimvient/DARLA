import { useMemo, useState } from "react";
import CausalDrilldownDrawer from "../components/causal/CausalDrilldownDrawer";
import {
  buildCausalGraphForEntity,
  buildCausalGraphForEvent,
  buildCausalGraphForCoa,
  contextFromEntity,
  contextFromEvent,
  contextFromCoa,
  type CausalGraph,
  type CausalSelectionContext,
} from "../data/causalModel";
import { fetchCausalSubgraph } from "../api";
import { useSimulation } from "../context/SimulationContext";
import type { CourseOfAction, MapEntity, SimEvent } from "../types";
import { causalSubgraphToGraph } from "../utils/causalSubgraph";

export function useCausalDrilldown() {
  const { dashboard, events, entities, runIdentity } = useSimulation();
  const [open, setOpen] = useState(false);
  const [context, setContext] = useState<CausalSelectionContext | null>(null);
  const [graph, setGraph] = useState<CausalGraph | null>(null);

  const coaCount = dashboard?.coa_log?.length ?? 0;

  const openForEntity = (entity: MapEntity) => {
    setContext(contextFromEntity(entity));
    const fallbackGraph = () => buildCausalGraphForEntity(entity, dashboard, events);
    if (runIdentity?.run_id) {
      setGraph(fallbackGraph());
      setOpen(true);
      void fetchCausalSubgraph(runIdentity.run_id, { entity: entity.id })
        .then((subgraph) => {
          const fromApi = causalSubgraphToGraph(subgraph);
          if (fromApi.nodes.length > 0 || fromApi.edges.length > 0) {
            setGraph(fromApi);
          }
        })
        .catch(() => {
          setGraph(fallbackGraph());
        });
      return;
    }
    setGraph(fallbackGraph());
    setOpen(true);
  };

  const openForEntityId = (entityId: string) => {
    const entity = entities.find((e) => e.id === entityId);
    if (entity) openForEntity(entity);
  };

  const openForEvent = (event: SimEvent) => {
    const fallbackGraph = () => buildCausalGraphForEvent(event, dashboard, events);
    setContext(contextFromEvent(event, coaCount));
    setGraph(fallbackGraph());
    setOpen(true);
    if (runIdentity?.run_id) {
      void fetchCausalSubgraph(runIdentity.run_id, { event_id: event.event_id })
        .then((subgraph) => {
          const fromApi = causalSubgraphToGraph(subgraph);
          if (fromApi.nodes.length > 0 || fromApi.edges.length > 0) {
            setGraph(fromApi);
          }
        })
        .catch(() => {
          setGraph(fallbackGraph());
        });
    }
  };

  const openForCoa = (coa: CourseOfAction) => {
    const fallbackGraph = () => buildCausalGraphForCoa(coa, dashboard, events);
    setContext(contextFromCoa(coa));
    setGraph(fallbackGraph());
    setOpen(true);
    if (runIdentity?.run_id) {
      void fetchCausalSubgraph(runIdentity.run_id, { coa_id: coa.id })
        .then((subgraph) => {
          const fromApi = causalSubgraphToGraph(subgraph, coa);
          if (fromApi.nodes.length > 0 || fromApi.edges.length > 0) {
            setGraph(fromApi);
          }
        })
        .catch(() => {
          setGraph(fallbackGraph());
        });
    }
  };

  const close = () => setOpen(false);

  const drawer = useMemo(
    () => (
      <CausalDrilldownDrawer open={open} onClose={close} context={context} graph={graph} />
    ),
    [open, context, graph],
  );

  return { openForEntityId, openForEvent, openForCoa, close, drawer };
}
