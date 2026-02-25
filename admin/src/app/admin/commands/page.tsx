"use client";

import { useEffect, useState } from "react";
import {
  Terminal, Play, RefreshCw, Clock, CheckCircle, XCircle,
  AlertTriangle, Pause, Trash2, Zap, Server, Activity,
  Filter, Search, Calendar, Download,
} from "lucide-react";
import { StatSkeleton, ListRowSkeleton } from "@/components/StatSkeleton";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const ADMIN_KEY = process.env.NEXT_PUBLIC_ADMIN_KEY || "";

interface Command {
  id: string;
  tenant_id: string;
  command_type: string;
  payload: any;
  priority: number;
  retry_count: number;
  scheduled_at: string;
  status: string;
  executed_at?: string;
  result?: any;
  error_message?: string;
  created_at: string;
}

interface QueueStats {
  status_counts: Record<string, number>;
  type_counts: Record<string, number>;
  pending_count: number;
  avg_pending_age_seconds: number;
  total: number;
}

export default function CommandsPage() {
  const [commands, setCommands] = useState<Command[]>([]);
  const [stats, setStats] = useState<QueueStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [selectedCommands, setSelectedCommands] = useState<string[]>([]);
  const [showBulkActions, setShowBulkActions] = useState(false);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [queueRes, statsRes] = await Promise.all([
        fetch(`${API_URL}/api/admin/commands/queue?limit=100`, {
          headers: { "X-Admin-Key": ADMIN_KEY },
        }),
        fetch(`${API_URL}/api/admin/commands/stats`, {
          headers: { "X-Admin-Key": ADMIN_KEY },
        }),
      ]);

      if (queueRes.ok) {
        const queueData = await queueRes.json();
        setCommands(queueData.commands || []);
      }

      if (statsRes.ok) {
        setStats(await statsRes.json());
      }
    } catch {}
    setLoading(false);
  }

  async function retryCommand(commandId: string) {
    try {
      const r = await fetch(`${API_URL}/api/admin/commands/${commandId}/retry`, {
        method: "POST",
        headers: { "X-Admin-Key": ADMIN_KEY },
      });
      if (r.ok) {
        loadData();
      }
    } catch {}
  }

  async function retryAllFailed() {
    try {
      const r = await fetch(`${API_URL}/api/admin/commands/retry/all`, {
        method: "POST",
        headers: { "X-Admin-Key": ADMIN_KEY },
      });
      if (r.ok) {
        loadData();
      }
    } catch {}
  }

  async function cleanupOld() {
    try {
      const r = await fetch(`${API_URL}/api/admin/commands/cleanup?days=7`, {
        method: "DELETE",
        headers: { "X-Admin-Key": ADMIN_KEY },
      });
      if (r.ok) {
        loadData();
      }
    } catch {}
  }

  const filteredCommands = commands.filter(cmd => {
    const matchesSearch = search === "" || 
      cmd.command_type.toLowerCase().includes(search.toLowerCase()) ||
      cmd.tenant_id.toLowerCase().includes(search.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || cmd.status === statusFilter;
    const matchesType = typeFilter === "all" || cmd.command_type === typeFilter;
    
    return matchesSearch && matchesStatus && matchesType;
  });

  const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
    pending: { label: "Pending", color: "text-yellow-400 bg-yellow-500/10", icon: Clock },
    processing: { label: "Processing", color: "text-blue-400 bg-blue-500/10", icon: Activity },
    completed: { label: "Completed", color: "text-green-400 bg-green-500/10", icon: CheckCircle },
    failed: { label: "Failed", color: "text-red-400 bg-red-500/10", icon: XCircle },
    cancelled: { label: "Cancelled", color: "text-white/30 bg-white/5", icon: Pause },
  };

  const priorityConfig: Record<number, { label: string; color: string }> = {
    1: { label: "Critical", color: "text-red-400" },
    2: { label: "High", color: "text-orange-400" },
    5: { label: "Normal", color: "text-white/60" },
    10: { label: "Low", color: "text-white/30" },
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1.5">
            <div className="h-7 w-48 animate-pulse rounded bg-white/5" />
            <div className="h-3 w-64 animate-pulse rounded bg-white/[0.03]" />
          </div>
        </div>
        <StatSkeleton count={5} />
        <ListRowSkeleton count={8} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Terminal className="h-6 w-6 text-brand-400" /> Command Queue
          </h1>
          <p className="mt-0.5 text-sm text-white/40">
            Proactive command management for all WordPress sites
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={retryAllFailed}
            className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2 text-xs text-white/50 transition hover:bg-white/10"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Retry All Failed
          </button>
          <button
            onClick={cleanupOld}
            className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2 text-xs text-white/50 transition hover:bg-white/10"
          >
            <Trash2 className="h-3.5 w-3.5" /> Cleanup Old
          </button>
          <button
            onClick={loadData}
            className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-xs font-medium text-white transition hover:bg-brand-500"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <StatCard icon={Terminal} label="Total" value={stats.total} color="brand" />
          <StatCard icon={Clock} label="Pending" value={stats.pending_count} color={stats.pending_count > 50 ? "yellow" : "green"} />
          <StatCard icon={CheckCircle} label="Completed" value={stats.status_counts.completed || 0} color="green" />
          <StatCard icon={XCircle} label="Failed" value={stats.status_counts.failed || 0} color="red" />
          <StatCard icon={Activity} label="Avg Age" value={`${Math.round(stats.avg_pending_age_seconds / 60)}m`} color="brand" />
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2">
          <Search className="h-3.5 w-3.5 text-white/40" />
          <input
            type="text"
            placeholder="Search commands..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-48 bg-transparent text-xs text-white placeholder-white/40 outline-none"
          />
        </div>
        
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg bg-white/5 px-3 py-2 text-xs text-white/70 outline-none"
        >
          <option value="all">All Status</option>
          {Object.entries(statusConfig).map(([value, config]) => (
            <option key={value} value={value}>{config.label}</option>
          ))}
        </select>

        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="rounded-lg bg-white/5 px-3 py-2 text-xs text-white/70 outline-none"
        >
          <option value="all">All Types</option>
          {stats && Object.keys(stats.type_counts).map(type => (
            <option key={type} value={type}>{type}</option>
          ))}
        </select>

        <div className="ml-auto text-xs text-white/40">
          {filteredCommands.length} of {commands.length} commands
        </div>
      </div>

      {/* Commands List */}
      <div className="space-y-1.5">
        {filteredCommands.map((cmd) => {
          const statusCfg = statusConfig[cmd.status] || statusConfig.pending;
          const StatusIcon = statusCfg.icon;
          const priorityCfg = priorityConfig[cmd.priority] || priorityConfig[5];
          
          return (
            <div
              key={cmd.id}
              className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-3 transition hover:border-white/10"
            >
              <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${statusCfg.color}`}>
                <StatusIcon className="h-3.5 w-3.5" />
              </div>
              
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{cmd.command_type}</span>
                  <span className={`text-xs font-medium ${priorityCfg.color}`}>
                    {priorityCfg.label}
                  </span>
                  {cmd.retry_count > 0 && (
                    <span className="rounded-full bg-orange-500/10 px-1.5 py-0.5 text-[9px] text-orange-400">
                      Retry {cmd.retry_count}
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-[10px] text-white/25">
                  Tenant: {cmd.tenant_id.slice(0, 8)}... • 
                  Scheduled: {new Date(cmd.scheduled_at).toLocaleString()}
                </p>
                {cmd.error_message && (
                  <p className="mt-1 text-[10px] text-red-400 truncate">
                    {cmd.error_message}
                  </p>
                )}
              </div>
              
              <div className="flex items-center gap-2">
                <code className="rounded bg-black/20 px-2 py-0.5 font-mono text-[10px] text-white/40">
                  {cmd.id.slice(0, 8)}
                </code>
                
                {cmd.status === "failed" && (
                  <button
                    onClick={() => retryCommand(cmd.id)}
                    className="rounded-lg bg-white/5 p-1.5 text-white/40 transition hover:bg-white/10 hover:text-white"
                  >
                    <RefreshCw className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {filteredCommands.length === 0 && (
        <div className="py-20 text-center">
          <Terminal className="mx-auto h-12 w-12 text-white/10" />
          <p className="mt-3 text-sm text-white/30">No commands found</p>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: number | string; color: string }) {
  const colorMap: Record<string, string> = {
    brand: "border-brand-500/20 bg-brand-500/5", green: "border-green-500/20 bg-green-500/5",
    yellow: "border-yellow-500/20 bg-yellow-500/5", red: "border-red-500/20 bg-red-500/5",
    blue: "border-blue-500/20 bg-blue-500/5", purple: "border-purple-500/20 bg-purple-500/5",
  };
  const iconMap: Record<string, string> = {
    brand: "text-brand-400", green: "text-green-400", yellow: "text-yellow-400",
    red: "text-red-400", blue: "text-blue-400", purple: "text-purple-400",
  };
  return (
    <div className={`rounded-xl border p-4 ${colorMap[color] || colorMap.brand}`}>
      <div className="flex items-center gap-2">
        <Icon className={`h-4 w-4 ${iconMap[color] || iconMap.brand}`} />
        <span className="text-[10px] font-medium uppercase tracking-wider text-white/40">{label}</span>
      </div>
      <p className="mt-2 text-2xl font-bold">{value}</p>
    </div>
  );
}
