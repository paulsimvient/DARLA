import { ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";

type DrilldownButtonProps = {
  label: string;
  to?: string;
  onClick?: () => void;
  className?: string;
};

export default function DrilldownButton({ label, to, onClick, className = "" }: DrilldownButtonProps) {
  const base =
    `inline-flex items-center gap-0.5 text-[11px] font-medium text-darla-blue transition-colors hover:text-blue-300 ${className}`;

  if (to) {
    return (
      <Link to={to} className={base}>
        {label}
        <ChevronRight size={12} />
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className={base}>
      {label}
      <ChevronRight size={12} />
    </button>
  );
}
