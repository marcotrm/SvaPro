const fs = require('fs');
const f = 'resources/js/pages/ShiftsPage.jsx';
let c = fs.readFileSync(f, 'utf8');

// 1. Fix role detection (lines ~1104-1106)
c = c.replace(
  `  // Ruoli turni
  const isDipendente   = userRoles.includes('dipendente');
  const isShiftManager = userRoles.includes('admin') || userRoles.includes('shift_manager') || !isDipendente;`,
  `  // Ruoli turni
  const isDipendente     = userRoles.includes('dipendente') && !userRoles.includes('store_manager') && !userRoles.includes('project_manager') && !userRoles.includes('superadmin');
  const isStoreManager   = userRoles.includes('store_manager');
  const isProjectManager = userRoles.includes('project_manager');
  const isSuperAdmin     = userRoles.includes('superadmin');
  const isShiftManager   = isStoreManager || isProjectManager || isSuperAdmin || userRoles.includes('admin') || userRoles.includes('shift_manager');`
);

// 2. Add lock state after line with allEmpLoading state
c = c.replace(
  `  const [allEmpLoading, setAllEmpLoading] = useState(false);`,
  `  const [allEmpLoading, setAllEmpLoading] = useState(false);

  // ── Week lock/confirm state ──
  const [weekLockStatus, setWeekLockStatus] = useState(null); // { locked_at, confirmed_at, ... }
  const [lockLoading, setLockLoading]       = useState(false);
  const [pmStoresList, setPmStoresList]     = useState([]);
  const [pmWeekLocks, setPmWeekLocks]       = useState([]);
  const [pmLoading, setPmLoading]           = useState(false);
  const [pmPreviewStore, setPmPreviewStore] = useState(null);
  const [pmPreviewShifts, setPmPreviewShifts] = useState([]);
  const [pmPreviewEmps, setPmPreviewEmps]   = useState([]);
  const [pmPreviewLoading, setPmPreviewLoading] = useState(false);

  const isWeekLocked = weekLockStatus?.locked_at && !weekLockStatus?.confirmed_at;
  const isWeekConfirmed = !!weekLockStatus?.confirmed_at;
  const canEditGrid = isShiftManager && !isWeekLocked && !isWeekConfirmed && !isDipendente;`
);

// 3. Add lock loading effect after the gap detection useMemo
c = c.replace(
  `  // ── Gap detection (ricalcola ogni volta che shifts cambia) ──────────────────
  const gapAlerts = useMemo(() => detectGaps(shifts, weekDays), [shifts, weekDays]);`,
  `  // ── Gap detection (ricalcola ogni volta che shifts cambia) ──────────────────
  const gapAlerts = useMemo(() => detectGaps(shifts, weekDays), [shifts, weekDays]);

  // ── Carica stato lock della settimana ──
  const weekStartStr = formatDate(weekStart);
  const loadLockStatus = useCallback(async () => {
    if (!storeId) return;
    try {
      const res = await shiftsApi.getWeekLocks({ week_start: weekStartStr });
      const locks = res.data?.data || [];
      const myLock = locks.find(l => String(l.store_id) === String(storeId));
      setWeekLockStatus(myLock || null);
    } catch { setWeekLockStatus(null); }
  }, [storeId, weekStartStr]);

  useEffect(() => { loadLockStatus(); }, [loadLockStatus]);

  // ── Lock / Unlock ──
  const handleLockWeek = async () => {
    if (!storeId) return;
    setLockLoading(true);
    try {
      await shiftsApi.lockWeek({ store_id: Number(storeId), week_start: weekStartStr, user_id: user?.id });
      toast.success('🔒 Turni bloccati! Il Project Manager riceverà una notifica.');
      await loadLockStatus();
    } catch (e) { toast.error('Errore nel blocco dei turni'); }
    finally { setLockLoading(false); }
  };

  const handleUnlockWeek = async () => {
    if (!storeId) return;
    setLockLoading(true);
    try {
      await shiftsApi.unlockWeek({ store_id: Number(storeId), week_start: weekStartStr });
      toast.success('🔓 Turni sbloccati.');
      await loadLockStatus();
    } catch (e) { toast.error('Errore nello sblocco'); }
    finally { setLockLoading(false); }
  };

  // ── Project Manager: carica tutti gli store + lock status ──
  const loadPmDashboard = useCallback(async () => {
    if (!isProjectManager) return;
    setPmLoading(true);
    try {
      const [storesRes, locksRes] = await Promise.all([
        stores.getStores(),
        shiftsApi.getWeekLocks({ week_start: weekStartStr }),
      ]);
      setPmStoresList(storesRes.data?.data || storesRes.data || []);
      setPmWeekLocks(locksRes.data?.data || []);
    } catch {}
    finally { setPmLoading(false); }
  }, [isProjectManager, weekStartStr]);

  useEffect(() => { loadPmDashboard(); }, [loadPmDashboard]);

  // PM: conferma turni di uno store
  const handlePmConfirm = async (sid) => {
    try {
      await shiftsApi.confirmWeek({ store_id: Number(sid), week_start: weekStartStr, user_id: user?.id });
      toast.success('✅ Turni confermati!');
      setPmPreviewStore(null);
      loadPmDashboard();
    } catch { toast.error('Errore nella conferma'); }
  };

  // PM: preview turni di uno store
  const handlePmPreview = async (store) => {
    setPmPreviewStore(store);
    setPmPreviewLoading(true);
    try {
      const endDate = new Date(weekStart);
      endDate.setDate(endDate.getDate() + 6);
      const [shRes, empRes] = await Promise.all([
        shiftsApi.getAll({ store_id: store.id, start_date: weekStartStr, end_date: formatDate(endDate) }),
        employeesApi.getEmployees({ store_id: store.id }),
      ]);
      setPmPreviewShifts(shRes.data?.data || []);
      setPmPreviewEmps(empRes.data?.data || []);
    } catch {}
    finally { setPmPreviewLoading(false); }
  };`
);

// 4. Fix canEditShifts to use canEditGrid
c = c.replace(
  `  // Solo admin/shift_manager possono modificare turni altrui. Il dipendente può modificare solo la propria riga
  const canEditShifts = isShiftManager;`,
  `  // Solo admin/shift_manager possono modificare turni altrui. Il dipendente può modificare solo la propria riga
  const canEditShifts = isShiftManager;
  // canEditGrid sarà definito più avanti dopo lo stato weekLock`
);

// 5. Jolly button: restrict to project_manager + superadmin only
c = c.replace(
  `        {/* ── Bottone Jolly ── */}
        {canEditShifts && (`,
  `        {/* ── Bottone Jolly ── solo per Project Manager e SuperAdmin */}
        {(isProjectManager || isSuperAdmin) && canEditShifts && (`
);

// 6. In the cell click handler, respect lock. Find where cells are made clickable.
// Replace the condition for the saveChanges button to check lock
c = c.replace(
  `                {saving ? <Loader size={16} className="animate-spin" /> : <Save size={16} />} {isDipendente ? 'Invia Conferma Turni' : 'Salva Configurazioni'}`,
  `                {saving ? <Loader size={16} className="animate-spin" /> : <Save size={16} />} {isDipendente ? 'Invia Conferma Turni' : 'Salva Configurazioni'}`
);

fs.writeFileSync(f, c, 'utf8');
console.log('Done. Lines:', c.split('\n').length);
