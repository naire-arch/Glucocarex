# GlucoCare

A modular diabetes management web app built with React, TypeScript, Vite and Tailwind CSS. It defaults to **mmol/L** with a global toggle to **mg/dL** (`1 mmol/L = 18.0182 mg/dL`), and ships with 14 days of realistic demo data, including East African staples (ugali, chapati, sukuma wiki, mandazi, githeri and more).

> **Medical disclaimer:** GlucoCare is for informational and educational use only. It does not diagnose or treat any condition and does not replace professional medical advice. Always confirm insulin doses with your doctor or diabetes care team.

## Features

- **Patient view:** current glucose with trend, time in range, 14-day average, estimated HbA1c; interactive 24H / 7D / 14D chart with target-range shading and meal and insulin markers; bolus calculator; medication checklist with adherence streak; quick log (glucose, meals with food search, insulin, exercise); editable dose settings.
- **Caregiver view:** read-only live status, high and low alert history, emergency call card and hypoglycemia first-aid steps.
- **Doctor view:** clinical summary table, time-in-ranges, AGP summary by time of day, hypo and hyper episode counts, medication adherence, working CSV downloads and a print stylesheet.
- **Safety guardrails:** the bolus calculator blocks dosing when glucose is below 3.9 mmol/L (70 mg/dL) and shows the 15 g fast-acting carbohydrate protocol. Large doses need confirmation. Active insulin (IOB) is deducted to avoid stacking.

## Getting started

Requires Node.js 18 or newer.

```bash
npm install
npm run dev        # start the dev server
npm run build      # type-check and create a production build in dist/
npm run preview    # serve the production build locally
npm run lint       # ESLint (zero warnings allowed)
```

## Clinical formulas

| Item | Formula |
| --- | --- |
| Bolus | `Carbs / ICR + (CurrentBG - TargetBG) / ISF - Active IOB`, never below 0, rounded to the dose step |
| IOB | Linear decay of rapid-acting doses over the duration of insulin action (default 4 h) |
| Estimated HbA1c | `(mean mg/dL + 46.7) / 28.7` |
| GMI | `3.31 + 0.02392 x mean mg/dL` |
| Time in range | Very low < 3.0, low 3.0 to 3.8, in range 3.9 to 10.0, high 10.1 to 13.9, very high > 13.9 mmol/L |

All glucose values are stored in mmol/L and converted only for display, so switching units never changes stored data.

## Project structure

```text
src/
  types/diabetes.ts          Strict domain types
  utils/glucoseMath.ts       Unit conversion, TIR, eA1c, IOB, bolus, AGP, alert episodes
  utils/exportReport.ts      Report summary, CSV export, print
  utils/adherence.ts         Medication adherence and streaks
  utils/dateUtils.ts         Date helpers
  utils/glucoseStatus.ts     Status labels, colours, trend
  data/mockData.ts           14 days of seeded demo telemetry
  data/foodDatabase.ts       Foods with carb and GI data (incl. Kenyan staples)
  hooks/useDiabetesStore.ts  State hook synced with localStorage
  components/                UI: Navbar, DashboardMetrics, GlucoseChart, BolusCalculator,
                             QuickLogModal, MedicationTracker, CaregiverView,
                             DoctorReportView, SettingsPanel, RecentActivity, ui
```

## Adding a backend later

All persistence goes through the `StorageAdapter` interface in `src/hooks/useDiabetesStore.ts` (`load`, `save`, `clear`). Implement it against Supabase or Firebase and pass it to `useDiabetesStore(adapter)`. Components never touch storage directly.

## Deployment

- **Vercel / Netlify:** import the repository. Build command `npm run build`, output directory `dist`.
- **GitHub Pages:** push to `main`. The included workflow (`.github/workflows/deploy.yml`) builds and publishes. Enable Pages with source "GitHub Actions" in the repository settings. `vite.config.ts` uses a relative base, so no path changes are needed.

## Notes

- The demo data and the people and phone numbers in it are fictional. Replace the emergency contacts in `src/data/mockData.ts` or via your own storage adapter.
- Food carbohydrate and GI values are approximate and vary by recipe. Confirm with a dietitian.
- Data stays in the browser (localStorage). Clearing site data removes it.
