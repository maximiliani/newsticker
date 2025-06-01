import { ReactNode } from 'react';
import { DashboardNav } from '@/components/dashboard-nav';

// Instead of passing the icon components directly, pass string identifiers
const adminNavItems = [
  {
    title: 'Dashboard',
    href: '/protected/admin',
    icon: 'HomeIcon', // String identifier instead of component
  },
  {
    title: 'User Management',
    href: '/protected/admin/users',
    icon: 'UsersIcon',
  },
  {
    title: 'Instagram Feeds',
    href: '/protected/admin/instagram',
    icon: 'InstagramIcon',
  },
  {
    title: 'News Articles',
    href: '/protected/admin/articles',
    icon: 'NewspaperIcon',
  },
];

interface AdminLayoutProps {
  children: ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  return (
    <div className="flex min-h-screen flex-col">
      <div className="flex-1 items-start md:grid md:grid-cols-[220px_1fr] md:gap-6 lg:grid-cols-[240px_1fr] lg:gap-10">
        <aside className="fixed top-14 z-30 hidden h-[calc(100vh-3.5rem)] w-full shrink-0 overflow-y-auto border-r md:sticky md:block">
          <div className="py-6 pr-6 lg:py-8">
            <DashboardNav items={adminNavItems} />
          </div>
        </aside>
        <main className="flex w-full flex-col overflow-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}