import { Plus } from 'lucide-react';
import { useCallback, useState } from 'react';
import BolusCalculator from './components/BolusCalculator';
import CaregiverView from './components/CaregiverView';
import DashboardMetrics from './components/DashboardMetrics';
import DoctorReportView from './components/DoctorReportView';
import GlucoseChart from './components/GlucoseChart';
import MedicationTracker from './components/MedicationTracker';
import Navbar from './components/Navbar';
import QuickLogModal, { type LogTab } from './components/QuickLogModal';
import RecentActivity from './components/RecentActivity';
import SettingsPanel from './components/SettingsPanel';
import { useDiabetesStore } from './hooks/useDiabetesStore';

const ROLE_TITLE = {
  patient: 'My diabetes dashboard',
  caregiver: 'Caregiver monitor',
  doctor: 'Clinician report',
} as const;

export default function App() {
  const store = useDiabetesStore();
  const { state } = store;
  const { settings } = state;

  const [logOpen, setLogOpen] = useState(false);
  const [logTab, setLogTab] = useState<LogTab>('glucose');
  const [suggestedCarbs, setSuggestedCarbs] = useState<number | undefined>(undefined);
  const [confirmClear, setConfirmClear] = useState(false);

  const openLog = useCallback((tab: LogTab) => {
    setLogTab(tab);
    setLogOpen(true);
  }, []);
  const closeLog = useCallback(() => setLogOpen(false), []);

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar
        role={settings.role}
        unit={settings.unit}
        patientName={settings.patientName}
        onRoleChange={store.setRole}
        onUnitChange={store.setUnit}
      />

      <main className="mx-auto w-full max-w-6xl flex-1 space-y-5 px-4 py-5 pb-28 sm:py-6">
        <div className="no-print flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{ROLE_TITLE[settings.role]}</h1>
          {settings.role === 'patient' && (
            <button type="button" className="btn-primary hidden sm:inline-flex" onClick={() => openLog('glucose')}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Log
            </button>
          )}
        </div>

        {settings.role === 'patient' && (
          <>
            <DashboardMetrics glucose={state.glucose} settings={settings} />
            <GlucoseChart glucose={state.glucose} meals={state.meals} insulin={state.insulin} settings={settings} />
            <div className="grid gap-5 lg:grid-cols-2">
              <BolusCalculator
                key={`${settings.unit}-${suggestedCarbs ?? 'none'}`}
                glucose={state.glucose}
                insulin={state.insulin}
                settings={settings}
                suggestedCarbsG={suggestedCarbs}
                onLogDose={store.addInsulin}
              />
              <MedicationTracker
                medications={state.medications}
                intakes={state.medicationIntakes}
                onToggle={(id) => store.toggleMedication(id)}
              />
            </div>
            <div className="grid gap-5 lg:grid-cols-2">
              <RecentActivity state={state} />
              <SettingsPanel settings={settings} onChange={store.updateSettings} />
            </div>
          </>
        )}

        {settings.role === 'caregiver' && <CaregiverView state={state} />}
        {settings.role === 'doctor' && <DoctorReportView state={state} />}
      </main>

      {settings.role === 'patient' && (
        <button
          type="button"
          onClick={() => openLog('glucose')}
          className="no-print fixed bottom-20 right-4 z-40 flex h-14 items-center gap-2 rounded-full bg-teal-700 px-5 text-base font-semibold text-white shadow-lg hover:bg-teal-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal-600/40 sm:hidden"
          aria-label="Quick log"
        >
          <Plus className="h-5 w-5" aria-hidden="true" />
          Log
        </button>
      )}

      <QuickLogModal
        open={logOpen}
        initialTab={logTab}
        settings={settings}
        onClose={closeLog}
        onAddGlucose={store.addGlucose}
        onAddMeal={store.addMeal}
        onAddInsulin={store.addInsulin}
        onAddExercise={store.addExercise}
        onMealLogged={setSuggestedCarbs}
      />

      <footer className="border-t border-slate-200 bg-white" role="contentinfo">
        <div className="mx-auto max-w-6xl space-y-3 px-4 py-4">
          <p className="text-sm text-slate-700">
            <strong className="font-semibold">Medical disclaimer:</strong> GlucoCare is for informational and educational use
            only. It does not diagnose, treat or replace professional medical advice. Always confirm insulin doses and
            treatment decisions with your doctor or diabetes care team. In an emergency, call your local emergency number.
          </p>
          <div className="no-print flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500">
            <span>Data is stored only in this browser.</span>
            <button type="button" className="font-semibold text-teal-700 underline-offset-2 hover:underline" onClick={store.loadDemoData}>
              Load demo data
            </button>
            {confirmClear ? (
              <span className="flex items-center gap-2">
                Delete all logs?
                <button
                  type="button"
                  className="font-semibold text-rose-700 underline-offset-2 hover:underline"
                  onClick={() => {
                    store.clearAllData();
                    setSuggestedCarbs(undefined);
                    setConfirmClear(false);
                  }}
                >
                  Yes, delete
                </button>
                <button type="button" className="font-semibold text-slate-700 underline-offset-2 hover:underline" onClick={() => setConfirmClear(false)}>
                  Cancel
                </button>
              </span>
            ) : (
              <button type="button" className="font-semibold text-rose-700 underline-offset-2 hover:underline" onClick={() => setConfirmClear(true)}>
                Clear all data
              </button>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}
