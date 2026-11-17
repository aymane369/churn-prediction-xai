import { Outlet, ScrollRestoration } from 'react-router-dom'
import { CurtainProvider } from '@/components/layout/Curtain'

/** Top-level route element: provides the page-transition curtain to every route. */
export function Root() {
  return (
    <CurtainProvider>
      <Outlet />
      <ScrollRestoration />
    </CurtainProvider>
  )
}
