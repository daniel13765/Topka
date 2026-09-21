import type { Role } from '../../types/domain';
import { RoleDashboard } from '../../components/shared/RoleDashboard';

export function RoleDashboardPage({ role }: { role: Role }) {
  return <RoleDashboard role={role} />;
}
