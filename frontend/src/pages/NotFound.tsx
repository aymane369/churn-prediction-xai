import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/layout/PageHeader'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'

export default function NotFound() {
  useDocumentTitle('Page not found')
  return (
    <PageHeader eyebrow="404" title="This page doesn’t exist.">
      The link may be out of date. Head back to the dashboard or browse customers.
      <span className="mt-6 flex gap-2">
        <Button asChild>
          <Link to="/dashboard">Go to dashboard</Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/customers">Browse customers</Link>
        </Button>
      </span>
    </PageHeader>
  )
}
