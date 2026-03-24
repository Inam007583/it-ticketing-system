import { useState, useEffect, useCallback, useMemo } from "react";

// ═══════════════════════════════════════════════════════════
// IT TICKETING SYSTEM — "HelpFlow"
// A production-grade helpdesk with ticket management,
// SLA tracking, agent assignment, and analytics dashboard
// ═══════════════════════════════════════════════════════════

const PRIORITIES = {
  critical: { label: "Critical", color: "#ff3b5c", slaHours: 2 },
  high: { label: "High", color: "#ff8c42", slaHours: 8 },
  medium: { label: "Medium", color: "#ffd166", slaHours: 24 },
  low: { label: "Low", color: "#06d6a0", slaHours: 72 },
};

const STATUSES = {
  open: { label: "Open", color: "#00ccff", icon: "●" },
  in_progress: { label: "In Progress", color: "#ffd166", icon: "◐" },
  waiting: { label: "Waiting", color: "#ff8c42", icon: "◉" },
  resolved: { label: "Resolved", color: "#06d6a0", icon: "✓" },
  closed: { label: "Closed", color: "#6a6a80", icon: "✕" },
};

const CATEGORIES = [
  "Hardware", "Software", "Network", "Access/Permissions",
  "Email", "Printer", "VPN", "Other"
];

const AGENTS = [
  { id: 1, name: "Alex Chen", avatar: "AC", role: "L1 Support" },
  { id: 2, name: "Sarah Patel", avatar: "SP", role: "L2 Support" },
  { id: 3, name: "James Okafor", avatar: "JO", role: "L2 Support" },
  { id: 4, name: "Maya Singh", avatar: "MS", role: "L3 Engineer" },
];

const SEED_TICKETS = [
  {
    id: "TKT-001", subject: "Laptop won't boot after Windows update",
    description: "After the latest Windows update pushed last night, my Dell Latitude 5540 gets stuck on the spinning dots screen. Tried hard restart 3 times with no luck. Need this resolved ASAP for client presentation at 2pm.",
    priority: "critical", status: "in_progress", category: "Hardware",
    assignee: 1, requester: "David Kim", email: "d.kim@company.com",
    created: Date.now() - 3600000 * 1.5,
    updated: Date.now() - 3600000 * 0.5,
    comments: [
      { author: "Alex Chen", text: "Attempting remote boot repair via PXE. If that fails, will swap to loaner device.", time: Date.now() - 3600000 * 0.5, isAgent: true },
    ]
  },
  {
    id: "TKT-002", subject: "Cannot access shared drive \\\\fileserv\\marketing",
    description: "Getting 'Access Denied' when trying to open the marketing shared folder. Permissions were fine yesterday. Other team members also affected. Possibly related to the AD migration last weekend?",
    priority: "high", status: "open", category: "Access/Permissions",
    assignee: null, requester: "Emily Torres", email: "e.torres@company.com",
    created: Date.now() - 3600000 * 5,
    updated: Date.now() - 3600000 * 5,
    comments: []
  },
  {
    id: "TKT-003", subject: "Request for additional monitor",
    description: "I'd like to request a second monitor for my workstation in Building B, Room 204. My current setup only has a single 24\" display and I need more screen real estate for data analysis work.",
    priority: "low", status: "waiting", category: "Hardware",
    assignee: 2, requester: "Marcus Johnson", email: "m.johnson@company.com",
    created: Date.now() - 3600000 * 48,
    updated: Date.now() - 3600000 * 24,
    comments: [
      { author: "Sarah Patel", text: "Approved by manager. Checking inventory for available 27\" Dell U2723QE.", time: Date.now() - 3600000 * 24, isAgent: true },
    ]
  },
  {
    id: "TKT-004", subject: "VPN disconnects every 15 minutes",
    description: "Since switching to the new GlobalProtect VPN client, my connection drops roughly every 15 minutes. Running macOS Sonoma 14.3 on M2 MacBook Pro. Logs attached show timeout errors.",
    priority: "medium", status: "in_progress", category: "VPN",
    assignee: 4, requester: "Rachel Nguyen", email: "r.nguyen@company.com",
    created: Date.now() - 3600000 * 20,
    updated: Date.now() - 3600000 * 2,
    comments: [
      { author: "Maya Singh", text: "Reproduced the issue. Appears to be MTU mismatch on the new gateway. Pushing config change to test pool.", time: Date.now() - 3600000 * 2, isAgent: true },
    ]
  },
  {
    id: "TKT-005", subject: "Outlook calendar not syncing with mobile",
    description: "My Outlook calendar events are not appearing on my iPhone. I've tried removing and re-adding the Exchange account. Email works fine, only calendar is affected.",
    priority: "medium", status: "resolved", category: "Email",
    assignee: 1, requester: "Tom Bradley", email: "t.bradley@company.com",
    created: Date.now() - 3600000 * 72,
    updated: Date.now() - 3600000 * 48,
    comments: [
      { author: "Alex Chen", text: "Reset ActiveSync partnership on Exchange server. Calendar is now syncing. Please confirm on your end.", time: Date.now() - 3600000 * 50, isAgent: true },
      { author: "Tom Bradley", text: "Confirmed working now, thanks!", time: Date.now() - 3600000 * 48, isAgent: false },
    ]
  },
  {
    id: "TKT-006", subject: "New hire onboarding — need AD account + laptop",
    description: "New employee starting Monday March 31st: Lisa Park, Marketing Coordinator. Needs: AD account, email, laptop (standard config), access to marketing shared drive, and Adobe Creative Cloud license.",
    priority: "high", status: "open", category: "Access/Permissions",
    assignee: 3, requester: "HR Department", email: "hr@company.com",
    created: Date.now() - 3600000 * 10,
    updated: Date.now() - 3600000 * 10,
    comments: []
  },
];

// —— Utility functions ——
function timeAgo(ts) {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function slaRemaining(ticket) {
  if (ticket.status === "resolved" || ticket.status === "closed") return null;
  const slaMs = PRIORITIES[ticket.priority].slaHours * 3600000;
  const elapsed = Date.now() - ticket.created;
  const remaining = slaMs - elapsed;
  if (remaining <= 0) return { breached: true, text: "SLA BREACHED" };
  const hrs = Math.floor(remaining / 3600000);
  const mins = Math.floor((remaining % 3600000) / 60000);
  return { breached: false, text: `${hrs}h ${mins}m left` };
}

let ticketCounter = 7;
function genId() {
  return `TKT-${String(ticketCounter++).padStart(3, "0")}`;
}

// ═══════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════
export default function HelpFlow() {
  const [tickets, setTickets] = useState(SEED_TICKETS);
  const [view, setView] = useState("dashboard"); // dashboard | list | detail | create
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterPriority, setFilterPriority] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Force re-render for live SLA countdown
  const [, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 60000);
    return () => clearInterval(interval);
  }, []);

  const filteredTickets = useMemo(() => {
    let result = [...tickets];
    if (filterStatus !== "all") result = result.filter(t => t.status === filterStatus);
    if (filterPriority !== "all") result = result.filter(t => t.priority === filterPriority);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(t =>
        t.subject.toLowerCase().includes(q) ||
        t.id.toLowerCase().includes(q) ||
        t.requester.toLowerCase().includes(q)
      );
    }
    result.sort((a, b) => {
      if (sortBy === "newest") return b.created - a.created;
      if (sortBy === "oldest") return a.created - b.created;
      if (sortBy === "priority") {
        const order = { critical: 0, high: 1, medium: 2, low: 3 };
        return order[a.priority] - order[b.priority];
      }
      return 0;
    });
    return result;
  }, [tickets, filterStatus, filterPriority, searchQuery, sortBy]);

  const stats = useMemo(() => {
    const open = tickets.filter(t => t.status === "open").length;
    const inProgress = tickets.filter(t => t.status === "in_progress").length;
    const resolved = tickets.filter(t => t.status === "resolved" || t.status === "closed").length;
    const breached = tickets.filter(t => {
      const sla = slaRemaining(t);
      return sla && sla.breached;
    }).length;
    const avgResTime = (() => {
      const resolvedTickets = tickets.filter(t => t.status === "resolved" || t.status === "closed");
      if (resolvedTickets.length === 0) return "—";
      const total = resolvedTickets.reduce((sum, t) => sum + (t.updated - t.created), 0);
      const avgHrs = Math.round(total / resolvedTickets.length / 3600000);
      return `${avgHrs}h`;
    })();
    return { open, inProgress, resolved, breached, total: tickets.length, avgResTime };
  }, [tickets]);

  const createTicket = useCallback((data) => {
    const newTicket = {
      id: genId(),
      ...data,
      status: "open",
      assignee: null,
      created: Date.now(),
      updated: Date.now(),
      comments: [],
    };
    setTickets(prev => [newTicket, ...prev]);
    setView("list");
  }, []);

  const updateTicket = useCallback((id, updates) => {
    setTickets(prev => prev.map(t =>
      t.id === id ? { ...t, ...updates, updated: Date.now() } : t
    ));
  }, []);

  const addComment = useCallback((id, text, isAgent = true) => {
    setTickets(prev => prev.map(t => {
      if (t.id !== id) return t;
      const author = isAgent ? AGENTS.find(a => a.id === t.assignee)?.name || "Support Agent" : t.requester;
      return {
        ...t,
        updated: Date.now(),
        comments: [...t.comments, { author, text, time: Date.now(), isAgent }]
      };
    }));
  }, []);

  const openTicketDetail = (ticket) => {
    setSelectedTicket(ticket);
    setView("detail");
  };

  return (
    <div style={styles.app}>
      {/* SIDEBAR */}
      <aside style={{ ...styles.sidebar, width: sidebarOpen ? 240 : 60 }}>
        <div style={styles.sidebarHeader}>
          {sidebarOpen && <span style={styles.logoText}>Help<span style={styles.logoAccent}>Flow</span></span>}
          <button onClick={() => setSidebarOpen(!sidebarOpen)} style={styles.toggleBtn}>
            {sidebarOpen ? "◂" : "▷"}
          </button>
        </div>
        <nav style={styles.nav}>
          {[
            { id: "dashboard", icon: "◈", label: "Dashboard" },
            { id: "list", icon: "☰", label: "Tickets" },
            { id: "create", icon: "＋", label: "New Ticket" },
          ].map(item => (
            <button
              key={item.id}
              onClick={() => setView(item.id)}
              style={{
                ...styles.navItem,
                ...(view === item.id || (view === "detail" && item.id === "list") ? styles.navItemActive : {}),
                justifyContent: sidebarOpen ? "flex-start" : "center",
              }}
            >
              <span style={styles.navIcon}>{item.icon}</span>
              {sidebarOpen && <span>{item.label}</span>}
            </button>
          ))}
        </nav>
        {sidebarOpen && (
          <div style={styles.sidebarFooter}>
            <div style={styles.agentInfo}>
              <div style={styles.agentAvatarSmall}>AC</div>
              <div>
                <div style={styles.agentNameSmall}>Alex Chen</div>
                <div style={styles.agentRoleSmall}>L1 Support</div>
              </div>
            </div>
          </div>
        )}
      </aside>

      {/* MAIN CONTENT */}
      <main style={styles.main}>
        {view === "dashboard" && <Dashboard stats={stats} tickets={tickets} onViewTicket={openTicketDetail} onNavigate={setView} />}
        {view === "list" && (
          <TicketList
            tickets={filteredTickets}
            filterStatus={filterStatus}
            setFilterStatus={setFilterStatus}
            filterPriority={filterPriority}
            setFilterPriority={setFilterPriority}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            sortBy={sortBy}
            setSortBy={setSortBy}
            onSelect={openTicketDetail}
            onNew={() => setView("create")}
          />
        )}
        {view === "detail" && selectedTicket && (
          <TicketDetail
            ticket={tickets.find(t => t.id === selectedTicket.id)}
            onBack={() => setView("list")}
            onUpdate={updateTicket}
            onComment={addComment}
          />
        )}
        {view === "create" && <CreateTicket onCreate={createTicket} onCancel={() => setView("list")} />}
      </main>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════════════════════
function Dashboard({ stats, tickets, onViewTicket, onNavigate }) {
  const urgentTickets = tickets
    .filter(t => t.status !== "resolved" && t.status !== "closed")
    .sort((a, b) => {
      const order = { critical: 0, high: 1, medium: 2, low: 3 };
      return order[a.priority] - order[b.priority];
    })
    .slice(0, 5);

  const byCategory = {};
  tickets.forEach(t => { byCategory[t.category] = (byCategory[t.category] || 0) + 1; });
  const maxCat = Math.max(...Object.values(byCategory), 1);

  return (
    <div style={styles.dashContainer}>
      <div style={styles.pageHeader}>
        <h1 style={styles.pageTitle}>Dashboard</h1>
        <span style={styles.liveIndicator}>● Live</span>
      </div>

      {/* Stat Cards */}
      <div style={styles.statsGrid}>
        {[
          { label: "Open", value: stats.open, color: "#00ccff", sub: "Need attention" },
          { label: "In Progress", value: stats.inProgress, color: "#ffd166", sub: "Being worked on" },
          { label: "Resolved", value: stats.resolved, color: "#06d6a0", sub: "Completed" },
          { label: "SLA Breached", value: stats.breached, color: "#ff3b5c", sub: "Overdue tickets" },
          { label: "Total Tickets", value: stats.total, color: "#c084fc", sub: "All time" },
          { label: "Avg Resolution", value: stats.avgResTime, color: "#00ffaa", sub: "Mean time" },
        ].map((s, i) => (
          <div key={i} style={styles.statCard}>
            <div style={{ ...styles.statValue, color: s.color }}>{s.value}</div>
            <div style={styles.statLabel}>{s.label}</div>
            <div style={styles.statSub}>{s.sub}</div>
            <div style={{ ...styles.statBar, background: s.color }} />
          </div>
        ))}
      </div>

      <div style={styles.dashRow}>
        {/* Urgent Tickets */}
        <div style={{ ...styles.dashPanel, flex: 2 }}>
          <div style={styles.panelHeader}>
            <h3 style={styles.panelTitle}>⚡ Urgent Tickets</h3>
            <button onClick={() => onNavigate("list")} style={styles.linkBtn}>View all →</button>
          </div>
          {urgentTickets.map(t => (
            <div key={t.id} onClick={() => onViewTicket(t)} style={styles.miniTicket}>
              <div style={{ ...styles.priorityDot, background: PRIORITIES[t.priority].color }} />
              <div style={styles.miniTicketInfo}>
                <div style={styles.miniTicketSubject}>{t.subject}</div>
                <div style={styles.miniTicketMeta}>{t.id} · {t.requester} · {timeAgo(t.created)}</div>
              </div>
              <div style={{ ...styles.statusBadgeMini, color: STATUSES[t.status].color, borderColor: STATUSES[t.status].color }}>
                {STATUSES[t.status].label}
              </div>
              {(() => { const sla = slaRemaining(t); return sla ? (
                <div style={{ ...styles.slaMini, color: sla.breached ? "#ff3b5c" : "#06d6a0" }}>{sla.text}</div>
              ) : null; })()}
            </div>
          ))}
        </div>

        {/* Category Breakdown */}
        <div style={{ ...styles.dashPanel, flex: 1 }}>
          <h3 style={styles.panelTitle}>By Category</h3>
          <div style={{ marginTop: 16 }}>
            {Object.entries(byCategory).sort((a, b) => b[1] - a[1]).map(([cat, count]) => (
              <div key={cat} style={styles.catRow}>
                <div style={styles.catLabel}>{cat}</div>
                <div style={styles.catBarWrap}>
                  <div style={{ ...styles.catBar, width: `${(count / maxCat) * 100}%` }} />
                </div>
                <div style={styles.catCount}>{count}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// TICKET LIST
// ═══════════════════════════════════════════════════════════
function TicketList({ tickets, filterStatus, setFilterStatus, filterPriority, setFilterPriority, searchQuery, setSearchQuery, sortBy, setSortBy, onSelect, onNew }) {
  return (
    <div>
      <div style={styles.pageHeader}>
        <h1 style={styles.pageTitle}>Tickets</h1>
        <button onClick={onNew} style={styles.primaryBtn}>＋ New Ticket</button>
      </div>

      {/* Filters */}
      <div style={styles.filtersRow}>
        <input
          type="text"
          placeholder="Search tickets..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          style={styles.searchInput}
        />
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={styles.selectInput}>
          <option value="all">All Status</option>
          {Object.entries(STATUSES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)} style={styles.selectInput}>
          <option value="all">All Priority</option>
          {Object.entries(PRIORITIES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={styles.selectInput}>
          <option value="newest">Newest First</option>
          <option value="oldest">Oldest First</option>
          <option value="priority">Priority</option>
        </select>
      </div>

      <div style={styles.ticketCount}>{tickets.length} ticket{tickets.length !== 1 ? "s" : ""}</div>

      {/* Ticket Table */}
      <div style={styles.tableWrap}>
        <div style={styles.tableHeader}>
          <div style={{ width: 90 }}>ID</div>
          <div style={{ flex: 1 }}>Subject</div>
          <div style={{ width: 100 }}>Priority</div>
          <div style={{ width: 110 }}>Status</div>
          <div style={{ width: 130 }}>Requester</div>
          <div style={{ width: 100 }}>SLA</div>
          <div style={{ width: 80 }}>Created</div>
        </div>
        {tickets.length === 0 && <div style={styles.emptyState}>No tickets match your filters</div>}
        {tickets.map(t => {
          const sla = slaRemaining(t);
          return (
            <div key={t.id} onClick={() => onSelect(t)} style={styles.tableRow}>
              <div style={{ width: 90, color: "#00ccff", fontWeight: 600 }}>{t.id}</div>
              <div style={{ flex: 1 }}>
                <div style={styles.ticketSubject}>{t.subject}</div>
                <div style={styles.ticketCat}>{t.category}{t.assignee ? ` · ${AGENTS.find(a => a.id === t.assignee)?.name}` : ""}</div>
              </div>
              <div style={{ width: 100 }}>
                <span style={{ ...styles.priorityPill, background: PRIORITIES[t.priority].color + "18", color: PRIORITIES[t.priority].color, borderColor: PRIORITIES[t.priority].color + "40" }}>
                  {PRIORITIES[t.priority].label}
                </span>
              </div>
              <div style={{ width: 110 }}>
                <span style={{ ...styles.statusPill, color: STATUSES[t.status].color, borderColor: STATUSES[t.status].color + "50" }}>
                  {STATUSES[t.status].icon} {STATUSES[t.status].label}
                </span>
              </div>
              <div style={{ width: 130, color: "#b0b0c0" }}>{t.requester}</div>
              <div style={{ width: 100 }}>
                {sla ? <span style={{ color: sla.breached ? "#ff3b5c" : "#06d6a0", fontSize: 12, fontWeight: 600 }}>{sla.text}</span> : <span style={{ color: "#6a6a80" }}>—</span>}
              </div>
              <div style={{ width: 80, color: "#6a6a80", fontSize: 12 }}>{timeAgo(t.created)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// TICKET DETAIL
// ═══════════════════════════════════════════════════════════
function TicketDetail({ ticket, onBack, onUpdate, onComment }) {
  const [comment, setComment] = useState("");
  const [isAgent, setIsAgent] = useState(true);
  if (!ticket) return null;
  const sla = slaRemaining(ticket);
  const agent = ticket.assignee ? AGENTS.find(a => a.id === ticket.assignee) : null;

  const handleSubmitComment = () => {
    if (!comment.trim()) return;
    onComment(ticket.id, comment, isAgent);
    setComment("");
  };

  return (
    <div>
      <button onClick={onBack} style={styles.backBtn}>← Back to Tickets</button>
      <div style={styles.detailLayout}>
        {/* Main */}
        <div style={styles.detailMain}>
          <div style={styles.detailHeader}>
            <span style={{ color: "#00ccff", fontWeight: 700 }}>{ticket.id}</span>
            <span style={{ ...styles.priorityPill, background: PRIORITIES[ticket.priority].color + "18", color: PRIORITIES[ticket.priority].color, borderColor: PRIORITIES[ticket.priority].color + "40" }}>
              {PRIORITIES[ticket.priority].label}
            </span>
            {sla && <span style={{ fontSize: 13, fontWeight: 600, color: sla.breached ? "#ff3b5c" : "#06d6a0" }}>{sla.text}</span>}
          </div>
          <h2 style={styles.detailTitle}>{ticket.subject}</h2>
          <div style={styles.detailMeta}>
            Submitted by <strong>{ticket.requester}</strong> ({ticket.email}) · {timeAgo(ticket.created)}
          </div>

          <div style={styles.descriptionBox}>
            <div style={styles.descLabel}>Description</div>
            {ticket.description}
          </div>

          {/* Comments */}
          <div style={styles.commentsSection}>
            <h3 style={styles.commentsTitle}>Activity ({ticket.comments.length})</h3>
            {ticket.comments.length === 0 && <div style={styles.emptyComments}>No comments yet</div>}
            {ticket.comments.map((c, i) => (
              <div key={i} style={{ ...styles.commentCard, borderLeftColor: c.isAgent ? "#00ccff" : "#c084fc" }}>
                <div style={styles.commentHeader}>
                  <span style={{ fontWeight: 600, color: c.isAgent ? "#00ccff" : "#c084fc" }}>{c.author}</span>
                  <span style={styles.commentTime}>{timeAgo(c.time)}</span>
                </div>
                <div style={styles.commentText}>{c.text}</div>
              </div>
            ))}

            {/* Add comment */}
            <div style={styles.addComment}>
              <div style={styles.commentToggle}>
                <button onClick={() => setIsAgent(true)} style={{ ...styles.toggleOption, ...(isAgent ? styles.toggleActive : {}) }}>Agent Reply</button>
                <button onClick={() => setIsAgent(false)} style={{ ...styles.toggleOption, ...(!isAgent ? styles.toggleActive : {}) }}>User Reply</button>
              </div>
              <textarea
                value={comment}
                onChange={e => setComment(e.target.value)}
                placeholder="Type a reply..."
                rows={3}
                style={styles.commentInput}
              />
              <button onClick={handleSubmitComment} style={styles.primaryBtn}>Send Reply</button>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div style={styles.detailSidebar}>
          <div style={styles.sidebarCard}>
            <h4 style={styles.sidebarLabel}>Status</h4>
            <select value={ticket.status} onChange={e => onUpdate(ticket.id, { status: e.target.value })} style={styles.selectInputFull}>
              {Object.entries(STATUSES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
          <div style={styles.sidebarCard}>
            <h4 style={styles.sidebarLabel}>Priority</h4>
            <select value={ticket.priority} onChange={e => onUpdate(ticket.id, { priority: e.target.value })} style={styles.selectInputFull}>
              {Object.entries(PRIORITIES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
          <div style={styles.sidebarCard}>
            <h4 style={styles.sidebarLabel}>Category</h4>
            <select value={ticket.category} onChange={e => onUpdate(ticket.id, { category: e.target.value })} style={styles.selectInputFull}>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div style={styles.sidebarCard}>
            <h4 style={styles.sidebarLabel}>Assigned To</h4>
            <select value={ticket.assignee || ""} onChange={e => onUpdate(ticket.id, { assignee: e.target.value ? +e.target.value : null })} style={styles.selectInputFull}>
              <option value="">Unassigned</option>
              {AGENTS.map(a => <option key={a.id} value={a.id}>{a.name} ({a.role})</option>)}
            </select>
            {agent && (
              <div style={styles.assignedAgent}>
                <div style={styles.agentAvatarDetail}>{agent.avatar}</div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#e0e0e8" }}>{agent.name}</div>
                  <div style={{ fontSize: 11, color: "#6a6a80" }}>{agent.role}</div>
                </div>
              </div>
            )}
          </div>
          <div style={styles.sidebarCard}>
            <h4 style={styles.sidebarLabel}>SLA</h4>
            <div style={{ fontSize: 13, color: "#b0b0c0" }}>Target: {PRIORITIES[ticket.priority].slaHours}h</div>
            {sla && <div style={{ fontSize: 14, fontWeight: 700, marginTop: 4, color: sla.breached ? "#ff3b5c" : "#06d6a0" }}>{sla.text}</div>}
            {!sla && <div style={{ fontSize: 13, color: "#06d6a0", marginTop: 4 }}>✓ Resolved</div>}
          </div>
          <div style={styles.sidebarCard}>
            <h4 style={styles.sidebarLabel}>Timeline</h4>
            <div style={{ fontSize: 12, color: "#6a6a80" }}>Created: {new Date(ticket.created).toLocaleDateString()} {new Date(ticket.created).toLocaleTimeString()}</div>
            <div style={{ fontSize: 12, color: "#6a6a80", marginTop: 4 }}>Updated: {timeAgo(ticket.updated)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// CREATE TICKET
// ═══════════════════════════════════════════════════════════
function CreateTicket({ onCreate, onCancel }) {
  const [form, setForm] = useState({
    subject: "", description: "", priority: "medium",
    category: "Software", requester: "", email: ""
  });
  const [errors, setErrors] = useState({});

  const validate = () => {
    const e = {};
    if (!form.subject.trim()) e.subject = "Subject is required";
    if (!form.description.trim()) e.description = "Description is required";
    if (!form.requester.trim()) e.requester = "Requester name is required";
    if (!form.email.trim()) e.email = "Email is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = () => {
    if (validate()) onCreate(form);
  };

  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: undefined }));
  };

  return (
    <div>
      <div style={styles.pageHeader}>
        <h1 style={styles.pageTitle}>Create New Ticket</h1>
      </div>
      <div style={styles.formCard}>
        <div style={styles.formGrid}>
          <div style={styles.formGroup}>
            <label style={styles.formLabel}>Requester Name *</label>
            <input style={{ ...styles.formInput, ...(errors.requester ? styles.inputError : {}) }} value={form.requester} onChange={e => handleChange("requester", e.target.value)} placeholder="Who is reporting this issue?" />
            {errors.requester && <span style={styles.errorText}>{errors.requester}</span>}
          </div>
          <div style={styles.formGroup}>
            <label style={styles.formLabel}>Email *</label>
            <input style={{ ...styles.formInput, ...(errors.email ? styles.inputError : {}) }} type="email" value={form.email} onChange={e => handleChange("email", e.target.value)} placeholder="requester@company.com" />
            {errors.email && <span style={styles.errorText}>{errors.email}</span>}
          </div>
        </div>

        <div style={styles.formGroup}>
          <label style={styles.formLabel}>Subject *</label>
          <input style={{ ...styles.formInput, ...(errors.subject ? styles.inputError : {}) }} value={form.subject} onChange={e => handleChange("subject", e.target.value)} placeholder="Brief summary of the issue" />
          {errors.subject && <span style={styles.errorText}>{errors.subject}</span>}
        </div>

        <div style={styles.formGroup}>
          <label style={styles.formLabel}>Description *</label>
          <textarea style={{ ...styles.formTextarea, ...(errors.description ? styles.inputError : {}) }} rows={5} value={form.description} onChange={e => handleChange("description", e.target.value)} placeholder="Provide details — what happened, when, any error messages, steps to reproduce..." />
          {errors.description && <span style={styles.errorText}>{errors.description}</span>}
        </div>

        <div style={styles.formGrid}>
          <div style={styles.formGroup}>
            <label style={styles.formLabel}>Priority</label>
            <select style={styles.formSelect} value={form.priority} onChange={e => handleChange("priority", e.target.value)}>
              {Object.entries(PRIORITIES).map(([k, v]) => <option key={k} value={k}>{v.label} (SLA: {v.slaHours}h)</option>)}
            </select>
          </div>
          <div style={styles.formGroup}>
            <label style={styles.formLabel}>Category</label>
            <select style={styles.formSelect} value={form.category} onChange={e => handleChange("category", e.target.value)}>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        <div style={styles.formActions}>
          <button onClick={onCancel} style={styles.secondaryBtn}>Cancel</button>
          <button onClick={handleSubmit} style={styles.primaryBtn}>Submit Ticket</button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════
const styles = {
  app: {
    display: "flex", height: "100vh", background: "#0b0b12",
    fontFamily: "'IBM Plex Mono', 'JetBrains Mono', 'Fira Code', monospace",
    color: "#e0e0e8", overflow: "hidden",
  },
  // Sidebar
  sidebar: {
    background: "#0f0f18", borderRight: "1px solid #1e1e2e",
    display: "flex", flexDirection: "column", transition: "width 0.3s",
    flexShrink: 0, overflow: "hidden",
  },
  sidebarHeader: {
    padding: "20px 16px", display: "flex", alignItems: "center",
    justifyContent: "space-between", borderBottom: "1px solid #1e1e2e",
  },
  logoText: { fontSize: 20, fontWeight: 800, color: "#e0e0e8", letterSpacing: -0.5 },
  logoAccent: { color: "#00ffaa" },
  toggleBtn: {
    background: "none", border: "none", color: "#6a6a80", fontSize: 14,
    cursor: "pointer", padding: 4,
  },
  nav: { padding: "12px 8px", display: "flex", flexDirection: "column", gap: 4, flex: 1 },
  navItem: {
    display: "flex", alignItems: "center", gap: 12, padding: "10px 14px",
    background: "none", border: "none", color: "#6a6a80", fontSize: 13,
    cursor: "pointer", borderRadius: 6, transition: "all 0.2s",
    fontFamily: "inherit",
  },
  navItemActive: { background: "rgba(0,255,170,0.06)", color: "#00ffaa" },
  navIcon: { fontSize: 16, width: 20, textAlign: "center" },
  sidebarFooter: { padding: "16px", borderTop: "1px solid #1e1e2e" },
  agentInfo: { display: "flex", alignItems: "center", gap: 10 },
  agentAvatarSmall: {
    width: 32, height: 32, borderRadius: "50%", background: "rgba(0,255,170,0.12)",
    color: "#00ffaa", display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: 11, fontWeight: 700,
  },
  agentNameSmall: { fontSize: 12, fontWeight: 600, color: "#e0e0e8" },
  agentRoleSmall: { fontSize: 10, color: "#6a6a80" },

  // Main
  main: { flex: 1, overflow: "auto", padding: "28px 32px" },

  // Page header
  pageHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 },
  pageTitle: { fontSize: 24, fontWeight: 700, letterSpacing: -0.5, fontFamily: "inherit", margin: 0 },
  liveIndicator: { color: "#06d6a0", fontSize: 12, fontWeight: 600 },

  // Stats
  statsGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 14, marginBottom: 28 },
  statCard: {
    background: "#111119", border: "1px solid #1e1e2e", borderRadius: 8,
    padding: "20px 18px", position: "relative", overflow: "hidden",
  },
  statValue: { fontSize: 28, fontWeight: 800, letterSpacing: -1 },
  statLabel: { fontSize: 12, fontWeight: 600, color: "#b0b0c0", marginTop: 4 },
  statSub: { fontSize: 10, color: "#6a6a80", marginTop: 2 },
  statBar: { position: "absolute", bottom: 0, left: 0, right: 0, height: 2, opacity: 0.5 },

  // Dashboard panels
  dashContainer: {},
  dashRow: { display: "flex", gap: 20 },
  dashPanel: { background: "#111119", border: "1px solid #1e1e2e", borderRadius: 8, padding: 20 },
  panelHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  panelTitle: { fontSize: 14, fontWeight: 700, fontFamily: "inherit", margin: 0 },
  linkBtn: { background: "none", border: "none", color: "#00ccff", fontSize: 12, cursor: "pointer", fontFamily: "inherit" },

  miniTicket: {
    display: "flex", alignItems: "center", gap: 12, padding: "10px 0",
    borderBottom: "1px solid #1a1a28", cursor: "pointer",
  },
  priorityDot: { width: 8, height: 8, borderRadius: "50%", flexShrink: 0 },
  miniTicketInfo: { flex: 1, minWidth: 0 },
  miniTicketSubject: { fontSize: 13, fontWeight: 600, color: "#e0e0e8", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  miniTicketMeta: { fontSize: 11, color: "#6a6a80", marginTop: 2 },
  statusBadgeMini: { fontSize: 10, fontWeight: 600, border: "1px solid", padding: "2px 8px", borderRadius: 3, flexShrink: 0 },
  slaMini: { fontSize: 10, fontWeight: 700, flexShrink: 0, marginLeft: 8 },

  catRow: { display: "flex", alignItems: "center", gap: 10, marginBottom: 10 },
  catLabel: { width: 100, fontSize: 12, color: "#b0b0c0", flexShrink: 0, textAlign: "right" },
  catBarWrap: { flex: 1, height: 6, background: "#1a1a28", borderRadius: 3, overflow: "hidden" },
  catBar: { height: "100%", background: "linear-gradient(90deg, #00ffaa, #00ccff)", borderRadius: 3, transition: "width 0.5s" },
  catCount: { width: 24, fontSize: 12, fontWeight: 600, color: "#00ffaa" },

  // Filters
  filtersRow: { display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" },
  searchInput: {
    flex: 1, minWidth: 200, padding: "10px 14px", background: "#111119",
    border: "1px solid #1e1e2e", borderRadius: 6, color: "#e0e0e8",
    fontSize: 13, fontFamily: "inherit", outline: "none",
  },
  selectInput: {
    padding: "10px 12px", background: "#111119", border: "1px solid #1e1e2e",
    borderRadius: 6, color: "#e0e0e8", fontSize: 12, fontFamily: "inherit",
    outline: "none", cursor: "pointer",
  },
  ticketCount: { fontSize: 12, color: "#6a6a80", marginBottom: 12 },

  // Table
  tableWrap: { background: "#111119", border: "1px solid #1e1e2e", borderRadius: 8, overflow: "hidden" },
  tableHeader: {
    display: "flex", padding: "12px 18px", borderBottom: "1px solid #1e1e2e",
    fontSize: 11, fontWeight: 700, color: "#6a6a80", textTransform: "uppercase",
    letterSpacing: 1, gap: 12,
  },
  tableRow: {
    display: "flex", padding: "14px 18px", borderBottom: "1px solid #13131d",
    alignItems: "center", gap: 12, cursor: "pointer", transition: "background 0.2s",
    fontSize: 13,
  },
  ticketSubject: { fontWeight: 600, color: "#e0e0e8", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  ticketCat: { fontSize: 11, color: "#6a6a80", marginTop: 2 },
  priorityPill: {
    display: "inline-block", fontSize: 11, fontWeight: 700, padding: "3px 10px",
    borderRadius: 4, border: "1px solid",
  },
  statusPill: {
    display: "inline-block", fontSize: 11, fontWeight: 600, padding: "3px 10px",
    borderRadius: 4, border: "1px solid",
  },
  emptyState: { padding: 40, textAlign: "center", color: "#6a6a80", fontSize: 14 },

  // Detail
  backBtn: {
    background: "none", border: "none", color: "#00ccff", fontSize: 13,
    cursor: "pointer", marginBottom: 20, fontFamily: "inherit", padding: 0,
  },
  detailLayout: { display: "flex", gap: 24 },
  detailMain: { flex: 1, minWidth: 0 },
  detailSidebar: { width: 260, flexShrink: 0, display: "flex", flexDirection: "column", gap: 12 },
  detailHeader: { display: "flex", alignItems: "center", gap: 12, marginBottom: 8 },
  detailTitle: { fontSize: 20, fontWeight: 700, letterSpacing: -0.5, marginBottom: 8, fontFamily: "inherit" },
  detailMeta: { fontSize: 13, color: "#6a6a80", marginBottom: 24 },
  descriptionBox: {
    background: "#111119", border: "1px solid #1e1e2e", borderRadius: 8,
    padding: 20, fontSize: 14, lineHeight: 1.7, color: "#c0c0d0", marginBottom: 28,
  },
  descLabel: { fontSize: 11, fontWeight: 700, color: "#6a6a80", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 },

  commentsSection: { marginBottom: 28 },
  commentsTitle: { fontSize: 14, fontWeight: 700, marginBottom: 16, fontFamily: "inherit" },
  emptyComments: { color: "#6a6a80", fontSize: 13, fontStyle: "italic" },
  commentCard: {
    background: "#111119", borderLeft: "3px solid", borderRadius: 6,
    padding: "14px 16px", marginBottom: 10,
  },
  commentHeader: { display: "flex", justifyContent: "space-between", marginBottom: 6 },
  commentTime: { fontSize: 11, color: "#6a6a80" },
  commentText: { fontSize: 13, lineHeight: 1.6, color: "#c0c0d0" },

  addComment: { marginTop: 20 },
  commentToggle: { display: "flex", gap: 4, marginBottom: 10 },
  toggleOption: {
    padding: "6px 14px", background: "#111119", border: "1px solid #1e1e2e",
    color: "#6a6a80", fontSize: 12, borderRadius: 4, cursor: "pointer", fontFamily: "inherit",
  },
  toggleActive: { borderColor: "#00ccff", color: "#00ccff", background: "rgba(0,204,255,0.06)" },
  commentInput: {
    width: "100%", padding: "12px 14px", background: "#111119", border: "1px solid #1e1e2e",
    borderRadius: 6, color: "#e0e0e8", fontSize: 13, fontFamily: "inherit",
    resize: "vertical", outline: "none", marginBottom: 10, boxSizing: "border-box",
  },

  sidebarCard: {
    background: "#111119", border: "1px solid #1e1e2e", borderRadius: 8, padding: 16,
  },
  sidebarLabel: { fontSize: 11, fontWeight: 700, color: "#6a6a80", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, fontFamily: "inherit", marginTop: 0 },
  selectInputFull: {
    width: "100%", padding: "8px 10px", background: "#0b0b12", border: "1px solid #1e1e2e",
    borderRadius: 4, color: "#e0e0e8", fontSize: 12, fontFamily: "inherit", outline: "none", cursor: "pointer",
    boxSizing: "border-box",
  },
  assignedAgent: { display: "flex", alignItems: "center", gap: 10, marginTop: 10 },
  agentAvatarDetail: {
    width: 36, height: 36, borderRadius: "50%", background: "rgba(0,204,255,0.12)",
    color: "#00ccff", display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: 12, fontWeight: 700,
  },

  // Buttons
  primaryBtn: {
    padding: "10px 20px", background: "#00ffaa", border: "none", borderRadius: 6,
    color: "#0b0b12", fontSize: 13, fontWeight: 700, cursor: "pointer",
    fontFamily: "inherit", letterSpacing: 0.5,
  },
  secondaryBtn: {
    padding: "10px 20px", background: "transparent", border: "1px solid #1e1e2e",
    borderRadius: 6, color: "#6a6a80", fontSize: 13, cursor: "pointer", fontFamily: "inherit",
  },

  // Form
  formCard: { background: "#111119", border: "1px solid #1e1e2e", borderRadius: 8, padding: 28 },
  formGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 },
  formGroup: { marginBottom: 18 },
  formLabel: { display: "block", fontSize: 12, fontWeight: 700, color: "#b0b0c0", marginBottom: 6, letterSpacing: 0.5 },
  formInput: {
    width: "100%", padding: "10px 14px", background: "#0b0b12", border: "1px solid #1e1e2e",
    borderRadius: 6, color: "#e0e0e8", fontSize: 13, fontFamily: "inherit", outline: "none",
    boxSizing: "border-box",
  },
  formTextarea: {
    width: "100%", padding: "10px 14px", background: "#0b0b12", border: "1px solid #1e1e2e",
    borderRadius: 6, color: "#e0e0e8", fontSize: 13, fontFamily: "inherit", outline: "none",
    resize: "vertical", boxSizing: "border-box",
  },
  formSelect: {
    width: "100%", padding: "10px 12px", background: "#0b0b12", border: "1px solid #1e1e2e",
    borderRadius: 6, color: "#e0e0e8", fontSize: 13, fontFamily: "inherit", outline: "none",
    cursor: "pointer", boxSizing: "border-box",
  },
  inputError: { borderColor: "#ff3b5c" },
  errorText: { fontSize: 11, color: "#ff3b5c", marginTop: 4, display: "block" },
  formActions: { display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 8 },
};
