import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { FileText, LayoutDashboard, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

export const AdminInsightsNav: React.FC = () => {
  const location = useLocation();
  const pathname = location.pathname;

  const tabs = [
    {
      label: 'Overview',
      href: '/admin/dashboard',
      icon: LayoutDashboard,
      isActive: pathname === '/admin/dashboard',
    },
    {
      label: 'Analytics',
      href: '/admin/analytics',
      icon: TrendingUp,
      isActive: pathname === '/admin/analytics',
    },
    {
      label: 'Reports',
      href: '/admin/reports',
      icon: FileText,
      isActive: pathname === '/admin/reports',
    },
  ];

  return (
    <div className="flex items-center gap-1.5 p-1 bg-muted/60 rounded-lg border border-border/60 w-fit">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        return (
          <Link
            key={tab.href}
            to={tab.href}
            className={cn(
              'flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-md transition-all duration-150',
              tab.isActive
                ? 'bg-background text-foreground shadow-xs border border-border/40 font-bold'
                : 'text-muted-foreground hover:text-foreground hover:bg-background/40',
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            <span>{tab.label}</span>
          </Link>
        );
      })}
    </div>
  );
};

export default AdminInsightsNav;
