import FormalRuntimeChainPanel from "./FormalRuntimeChainPanel";

type Props = {
  dashboardData: Record<string, any>;
};

export default function FormalRuntimeTab({ dashboardData }: Props) {
  return (
    <div style={{ padding: 16 }}>
      <FormalRuntimeChainPanel dashboardData={dashboardData} />
    </div>
  );
}
