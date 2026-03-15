import React, { ReactNode, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  FiHome,
  FiCalendar,
  FiSearch,
  FiSettings,
  FiMenu,
} from "react-icons/fi";
import ThemeModeToggle from './ThemeModeToggle';

interface NavItem {
  label: string;
  to: string;
  icon: ReactNode;
}

const navItems: NavItem[] = [
  {
    label: "Home",
    to: "/",
    icon: <FiHome className="text-xl" />,
  },
  {
    label: "Generate Schedule",
    to: "/schedule-gen-home",
    icon: <FiCalendar className="text-xl" />,
  },
  {
    label: "Explore my Options",
    to: "/exploration-assistant",
    icon: <FiSearch className="text-xl" />,
  },
  {
    label: "Settings",
    to: "/settings",
    icon: <FiSettings className="text-xl" />,
  },
];

export default function Sidebar() {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(() => 
    typeof window !== 'undefined' ? window.innerWidth < 768 : false
  );

  return (
    <aside
      className={[
        "flex h-screen flex-col bg-shell text-shell-contrast shadow-xl transition-[width] duration-300 ease-out",
        collapsed ? "w-20" : "w-64",
      ].join(" ")}
    >
      <div className="flex h-16 items-center justify-between border-b border-white/10 px-4">
        {!collapsed && (
          <span className="text-lg font-semibold tracking-tight">
            DegreeTrackr
          </span>
        )}
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          className="ml-auto flex h-11 w-11 sm:h-9 sm:w-9 items-center justify-center rounded-[15px] bg-white/15 text-shell-contrast shadow-sm transition-all duration-300 ease-linear hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-shell"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!collapsed}
        >
          <FiMenu className="text-[20px]" aria-hidden="true" />
        </button>
      </div>
      <nav className="flex flex-1 flex-col gap-1 py-4">
        {navItems.map((item) => {
          const isActive =
            item.to === "/"
              ? location.pathname === "/" || location.pathname === "/progress-page"
              : location.pathname === item.to;

          return (
            <Link
              key={item.to}
              to={item.to}
              aria-current={isActive ? "page" : undefined}
              aria-label={collapsed ? item.label : undefined}
              className={[
                "group relative flex items-center gap-3 py-3 text-sm font-medium transition-colors duration-200",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-shell",
                collapsed ? "justify-center px-0" : "px-6",
                isActive
                  ? "bg-white/15 text-white"
                  : "text-shell-contrast/80 hover:bg-white/10 hover:text-white",
              ].join(" ")}
            >
              <span aria-hidden="true" className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-lg transition-transform duration-200 group-hover:scale-110">
                {item.icon}
              </span>
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}
      </nav>
      <div className="px-3 pb-4">
        <ThemeModeToggle variant="shell" collapsed={collapsed} />
      </div>
    </aside>
  );
}
