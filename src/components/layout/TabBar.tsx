import { clsx } from 'clsx'
import { Activity, Dumbbell, Home, LineChart, Menu } from 'lucide-react'
import { NavLink } from 'react-router-dom'

const ITEMS = [
  { to: '/', label: 'Hoy', icon: Home, end: true },
  { to: '/train', label: 'Entrenar', icon: Dumbbell },
  { to: '/progress', label: 'Progreso', icon: LineChart },
  { to: '/body', label: 'Cuerpo', icon: Activity },
  { to: '/more', label: 'Más', icon: Menu },
] as const

/** Black dock; the active tab is the only gold thing in it. */
export function TabBar() {
  return (
    <nav
      aria-label="Principal"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-black/85 pb-[max(env(safe-area-inset-bottom),8px)] backdrop-blur-xl"
    >
      <ul className="mx-auto flex max-w-md items-stretch justify-around px-2 pt-1.5">
        {ITEMS.map(({ to, label, icon: Icon, ...rest }) => (
          <li key={to} className="flex-1">
            <NavLink
              to={to}
              end={'end' in rest}
              className={({ isActive }) =>
                clsx(
                  'flex min-h-12 flex-col items-center justify-center gap-1 text-[10.5px] font-semibold uppercase tracking-[0.08em] transition-colors active:scale-[0.97]',
                  isActive ? 'text-signal' : 'text-muted hover:text-ink-2',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon className="size-[21px]" strokeWidth={isActive ? 2.2 : 1.7} />
                  {label}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
