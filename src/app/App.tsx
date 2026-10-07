import { lazy, Suspense, type ReactNode } from 'react'
import { createHashRouter, Navigate, RouterProvider } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { Splash } from '@/components/layout/Splash'
import { LoginPage } from '@/features/auth/LoginPage'
import { TodayPage } from '@/features/today/TodayPage'
import { env } from '@/lib/env'
import { Providers } from './providers'
import { UpdatePrompt } from './UpdatePrompt'

// "Hoy" ships in the main bundle; every other screen loads on demand.
const named = <K extends string>(load: () => Promise<Record<K, React.ComponentType>>, name: K) =>
  lazy(() => load().then((m) => ({ default: m[name] })))

const OnboardingPage = named(() => import('@/features/auth/OnboardingPage'), 'OnboardingPage')
const TrainPage = named(() => import('@/features/train/TrainPage'), 'TrainPage')
const SessionPage = named(() => import('@/features/session/SessionPage'), 'SessionPage')
const SummaryPage = named(() => import('@/features/session/SummaryPage'), 'SummaryPage')
const WorkoutPage = named(() => import('@/features/train/WorkoutPage'), 'WorkoutPage')
const ProgramsPage = named(() => import('@/features/programs/ProgramsPage'), 'ProgramsPage')
const ProgramEditorPage = named(
  () => import('@/features/programs/ProgramEditorPage'),
  'ProgramEditorPage',
)
const ProgressPage = named(() => import('@/features/progress/ProgressPage'), 'ProgressPage')
const EvolutionPage = named(() => import('@/features/evolution/EvolutionPage'), 'EvolutionPage')
const ExercisePage = named(() => import('@/features/exercise/ExercisePage'), 'ExercisePage')
const LibraryPage = named(() => import('@/features/exercise/LibraryPage'), 'LibraryPage')
const BodyPage = named(() => import('@/features/body/BodyPage'), 'BodyPage')
const MorePage = named(() => import('@/features/more/MorePage'), 'MorePage')
const GoalsPage = named(() => import('@/features/goals/GoalsPage'), 'GoalsPage')
const GymPage = named(() => import('@/features/gym/GymPage'), 'GymPage')
const MachinePage = named(() => import('@/features/gym/MachinePage'), 'MachinePage')
const SettingsPage = named(() => import('@/features/settings/SettingsPage'), 'SettingsPage')
const HealthConnectPage = named(
  () => import('@/features/settings/HealthConnectPage'),
  'HealthConnectPage',
)

const page = (el: ReactNode) => <Suspense fallback={<Splash />}>{el}</Suspense>

// HashRouter: GitHub Pages has no rewrites, and a hash route survives the home-screen install.
export const router = createHashRouter([
  { path: '/auth', element: <LoginPage /> },
  { path: '/onboarding', element: page(<OnboardingPage />) },
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <TodayPage /> },
      { path: 'train', element: page(<TrainPage />) },
      { path: 'session', element: page(<SessionPage />) },
      { path: 'session/:workoutId/summary', element: page(<SummaryPage />) },
      { path: 'workout/:workoutId', element: page(<WorkoutPage />) },
      { path: 'programs', element: page(<ProgramsPage />) },
      { path: 'programs/:programId', element: page(<ProgramEditorPage />) },
      { path: 'progress', element: page(<ProgressPage />) },
      { path: 'evolution', element: page(<EvolutionPage />) },
      { path: 'exercise/:exerciseId', element: page(<ExercisePage />) },
      { path: 'library', element: page(<LibraryPage />) },
      { path: 'body', element: page(<BodyPage />) },
      { path: 'more', element: page(<MorePage />) },
      { path: 'goals', element: page(<GoalsPage />) },
      { path: 'gym', element: page(<GymPage />) },
      // A QR or NFC tag on a machine opens this: its exercise, settings and a start button.
      { path: 'm/:machineId', element: page(<MachinePage />) },
      { path: 'settings', element: page(<SettingsPage />) },
      { path: 'settings/health', element: page(<HealthConnectPage />) },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
])

export function App() {
  if (!env.isSupabaseConfigured) return <Splash error="Falta la configuración de Supabase." />
  return (
    <Providers>
      <RouterProvider router={router} />
      <UpdatePrompt />
    </Providers>
  )
}
