import { lazy } from 'react'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { MotionConfig } from 'motion/react'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AppShell } from '@/components/layout/AppShell'
import { Root } from '@/components/layout/Root'
import { queryClient } from '@/api/queries'

// Route-level code splitting keeps the entry chunk small (charts and avatars load with the pages that need them)
const Landing = lazy(() => import('@/pages/Landing'))
const Dashboard = lazy(() => import('@/pages/Dashboard'))
const Customers = lazy(() => import('@/pages/Customers'))
const CustomerProfile = lazy(() => import('@/pages/CustomerProfile'))
const Simulator = lazy(() => import('@/pages/Simulator'))
const NotFound = lazy(() => import('@/pages/NotFound'))

const router = createBrowserRouter([
  {
    element: <Root />,
    children: [
      { path: '/', element: <Landing /> },
      {
        element: <AppShell />,
        children: [
          { path: '/dashboard', element: <Dashboard /> },
          { path: '/customers', element: <Customers /> },
          { path: '/customers/:id', element: <CustomerProfile /> },
          { path: '/simulator', element: <Simulator /> },
          { path: '*', element: <NotFound /> },
        ],
      },
    ],
  },
])

export default function App() {
  return (
    // reducedMotion="user": transform/layout animations are skipped when the OS asks for less motion
    <MotionConfig reducedMotion="user">
      <QueryClientProvider client={queryClient}>
        <TooltipProvider delayDuration={120}>
          <RouterProvider router={router} />
        </TooltipProvider>
      </QueryClientProvider>
    </MotionConfig>
  )
}
