import { Droplet, HeartHandshake, Stethoscope, User, type LucideIcon } from 'lucide-react';
import type { GlucoseUnit, UserRole } from '../types/diabetes';

interface NavbarProps {
  role: UserRole;
  unit: GlucoseUnit;
  patientName: string;
  onRoleChange: (role: UserRole) => void;
  onUnitChange: (unit: GlucoseUnit) => void;
}

interface RoleOption {
  value: UserRole;
  label: string;
  Icon: LucideIcon;
}

const ROLES: RoleOption[] = [
  { value: 'patient', label: 'Patient', Icon: User },
  { value: 'caregiver', label: 'Caregiver', Icon: HeartHandshake },
  { value: 'doctor', label: 'Doctor', Icon: Stethoscope },
];

const UNITS: GlucoseUnit[] = ['mmol/L', 'mg/dL'];

export default function Navbar({ role, unit, patientName, onRoleChange, onUnitChange }: NavbarProps) {
  return (
    <header className="no-print sticky top-0 z-30 border-b border-teal-900/20 bg-teal-800 text-white shadow-md">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15" aria-hidden="true">
              <Droplet className="h-5 w-5" />
            </span>
            <div className="leading-tight">
              <p className="text-lg font-bold tracking-tight">GlucoCare</p>
              <p className="text-xs text-teal-100">Viewing: {patientName}</p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div role="group" aria-label="Switch view" className="flex rounded-xl bg-teal-900/50 p-1">
            {ROLES.map(({ value, label, Icon }) => {
              const active = role === value;
              return (
                <button
                  key={value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onRoleChange(value)}
                  className={`flex min-h-[40px] items-center gap-1.5 rounded-lg px-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${
                    active ? 'bg-white text-teal-900 shadow' : 'text-teal-50 hover:bg-white/10'
                  }`}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  <span>{label}</span>
                </button>
              );
            })}
          </div>

          <div role="group" aria-label="Glucose unit" className="flex rounded-xl bg-teal-900/50 p-1">
            {UNITS.map((u) => {
              const active = unit === u;
              return (
                <button
                  key={u}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onUnitChange(u)}
                  className={`min-h-[40px] rounded-lg px-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${
                    active ? 'bg-emerald-300 text-teal-950 shadow' : 'text-teal-50 hover:bg-white/10'
                  }`}
                >
                  {u}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </header>
  );
}
