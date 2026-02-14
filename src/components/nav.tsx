"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import {
  Calendar,
  LayoutDashboard,
  Settings,
  LogOut,
  Plus,
  Menu,
  X,
} from "lucide-react";
import { useState } from "react";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/capture", label: "Add Event", icon: Plus },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Nav() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-56 min-h-screen border-r border-gray-200 bg-white">
        <div className="p-4 border-b border-gray-200">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center">
              <Calendar className="w-4 h-4" />
            </div>
            <span className="font-semibold text-sm">Family Scheduler</span>
          </Link>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                  active
                    ? "bg-blue-50 text-blue-700 font-medium"
                    : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-gray-200">
          <div className="flex items-center gap-2 px-3 py-2">
            <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-xs font-medium text-gray-600">
              {session?.user?.name?.charAt(0) || "?"}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium truncate">
                {session?.user?.name}
              </div>
              <div className="text-xs text-gray-400 truncate">
                {session?.user?.email}
              </div>
            </div>
            <button
              onClick={() => signOut({ callbackUrl: "/signin" })}
              className="text-gray-400 hover:text-gray-600"
              title="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center">
            <Calendar className="w-3.5 h-3.5" />
          </div>
          <span className="font-semibold text-sm">Family Scheduler</span>
        </Link>
        <button onClick={() => setMobileOpen(!mobileOpen)}>
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile menu overlay */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-black/30" onClick={() => setMobileOpen(false)}>
          <div
            className="absolute top-14 right-0 w-56 bg-white border-l border-gray-200 shadow-lg h-full p-3"
            onClick={(e) => e.stopPropagation()}
          >
            <nav className="space-y-1">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
                      active
                        ? "bg-blue-50 text-blue-700 font-medium"
                        : "text-gray-600"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
            <div className="mt-4 pt-4 border-t">
              <button
                onClick={() => signOut({ callbackUrl: "/signin" })}
                className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600"
              >
                <LogOut className="w-4 h-4" />
                Sign out
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
