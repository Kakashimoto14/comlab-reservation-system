import { Bell, Search } from "lucide-react";

import { Input } from "../ui/Input";

export const Topbar = () => (
  <div className="mb-8 flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-soft sm:flex-row sm:items-center sm:justify-between">
    <div className="relative max-w-md flex-1">
      <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
      <Input className="pl-10" placeholder="Search pages, users, or reservation codes" />
    </div>
    <div className="flex items-center justify-end">
      <button className="rounded-2xl border border-slate-200 p-3 text-slate-500 transition hover:bg-slate-50">
        <Bell className="h-4 w-4" />
      </button>
    </div>
  </div>
);
