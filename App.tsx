
import React, { useState, useEffect, useMemo } from 'react';
import { Bed, BedStatus, Department, OccupancyLog, User, UserRole, Patient, DischargedPatient } from './types';
import { INITIAL_BEDS } from './constants';
import BedCard from './components/BedCard';
import OccupancyChart from './components/OccupancyChart';
import { generateOccupancyReport } from './services/geminiService';
import { dbService } from './services/dbService';

const App: React.FC = () => {
  // Auth State
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loginError, setLoginError] = useState('');

  // App State - Initialized directly from Database via functional initializers
  // This ensures that even on the very first frame of a refresh, the data is pulled correctly from localStorage.
  const [users, setUsers] = useState<User[]>(() => {
    const admin: User = { id: '1', username: 'admin', password: '1234', role: 'Admin', fullName: 'System Administrator' };
    return dbService.loadUsers(admin);
  });
  const [beds, setBeds] = useState<Bed[]>(() => dbService.loadBeds());
  const [dischargeHistory, setDischargeHistory] = useState<DischargedPatient[]>(() => dbService.loadHistory());
  const [sessionRevenue, setSessionRevenue] = useState<number>(() => dbService.loadRevenue());
  const [historyData, setHistoryData] = useState<OccupancyLog[]>(() => dbService.loadStatsHistory());

  const [activeTab, setActiveTab] = useState<'monitor' | 'reports' | 'users' | 'records'>('monitor');
  const [recordsSubTab, setRecordsSubTab] = useState<'active' | 'archived'>('active');
  const [report, setReport] = useState<any>(null);
  const [isLoadingReport, setIsLoadingReport] = useState(false);
  const [filterDept, setFilterDept] = useState<Department | 'All'>('All');
  
  // Modals / Selection
  const [selectedBed, setSelectedBed] = useState<Bed | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Discharge Modal State
  const [dischargeTargetBed, setDischargeTargetBed] = useState<Bed | null>(null);
  const [isDischargeModalOpen, setIsDischargeModalOpen] = useState(false);

  const [selectedArchiveRecord, setSelectedArchiveRecord] = useState<DischargedPatient | null>(null);
  const [isArchiveModalOpen, setIsArchiveModalOpen] = useState(false);

  // New User Form State
  const [newUser, setNewUser] = useState({ username: '', password: '', fullName: '', role: 'Staff' as UserRole });

  // Persistence Syncing
  // These effects ensure that any state changes made during the session are immediately committed to the local database.
  useEffect(() => { dbService.saveBeds(beds); }, [beds]);
  useEffect(() => { dbService.saveHistory(dischargeHistory); }, [dischargeHistory]);
  useEffect(() => { dbService.saveUsers(users); }, [users]);
  useEffect(() => { dbService.saveRevenue(sessionRevenue); }, [sessionRevenue]);
  useEffect(() => { dbService.saveStatsHistory(historyData); }, [historyData]);

  // Statistics Calculation
  const stats = useMemo(() => {
    const total = beds.length;
    const occupied = beds.filter(b => b.status === BedStatus.OCCUPIED).length;
    const cleaning = beds.filter(b => b.status === BedStatus.CLEANING).length;
    const maintenance = beds.filter(b => b.status === BedStatus.MAINTENANCE).length;
    const available = total - occupied - cleaning - maintenance;
    return { total, occupied, available, cleaning, maintenance, occupancyRate: total > 0 ? Math.round((occupied / total) * 100) : 0 };
  }, [beds]);

  const activePatients = useMemo(() => {
    return beds.filter(b => b.status === BedStatus.OCCUPIED && b.patient).map(b => ({
      ...b.patient!,
      bedNumber: b.number,
      department: b.department,
      originalBed: b
    }));
  }, [beds]);

  // Sync Daily Stats Chart
  useEffect(() => {
    if (beds.length === 0) return;
    const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    
    setHistoryData(prev => {
      const idx = prev.findIndex(h => h.timestamp === today);
      if (idx !== -1) {
        const updated = [...prev];
        updated[idx] = { ...updated[idx], occupied: stats.occupied, available: stats.available, total: stats.total };
        return updated;
      } else {
        return [...prev, { timestamp: today, occupied: stats.occupied, available: stats.available, total: stats.total, revenue: 0 }].slice(-7);
      }
    });
  }, [stats, beds.length]);

  // Authentication Handlers
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const target = e.target as any;
    const user = users.find(u => u.username === target.username.value && u.password === target.password.value);
    if (user) {
      setIsLoggedIn(true);
      setCurrentUser(user);
      setLoginError('');
    } else {
      setLoginError('Invalid credentials. Access Denied.');
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setCurrentUser(null);
    setActiveTab('monitor');
  };

  // Bed Status and Discharge Operations
  const handleStatusChange = (id: string, newStatus: BedStatus) => {
    const bed = beds.find(b => b.id === id);
    if (!bed) return;

    // Trigger discharge modal if shifting from Occupied
    if (bed.status === BedStatus.OCCUPIED && newStatus !== BedStatus.OCCUPIED && bed.patient) {
      setDischargeTargetBed(bed);
      setIsDischargeModalOpen(true);
      return; 
    }

    // Trigger admission modal if shifting to Occupied and empty
    if (newStatus === BedStatus.OCCUPIED && !bed.patient) {
      setSelectedBed({ ...bed, status: newStatus });
      setIsModalOpen(true);
    } else {
      setBeds(prev => prev.map(b => b.id === id ? { ...b, status: newStatus, patient: newStatus === BedStatus.OCCUPIED ? b.patient : undefined } : b));
    }
  };

  const finalizeDischarge = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dischargeTargetBed || !dischargeTargetBed.patient) return;
    const target = e.target as any;
    const summary = target.summary.value;
    const dischargeDateStr = target.dischargeDate.value;
    const finalBill = parseInt(target.finalBill.value) || dischargeTargetBed.patient.currentBill;

    const admission = new Date(dischargeTargetBed.patient.admissionDate);
    const discharge = new Date(dischargeDateStr);
    const diffTime = Math.abs(discharge.getTime() - admission.getTime());
    const stayDuration = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1;

    // Create the archival record - This is the "Person details" stored in DB
    const archivedRecord: DischargedPatient = {
      ...dischargeTargetBed.patient,
      dischargeDate: dischargeDateStr,
      dischargeSummary: summary || "No summary provided.",
      stayDuration,
      currentBill: finalBill
    };
    
    // Add to archive state - The effect handles the DB write
    setDischargeHistory(prev => [archivedRecord, ...prev]);
    setSessionRevenue(prev => prev + finalBill);

    // Update yield chart
    const todayLabel = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    setHistoryData(prev => {
      const index = prev.findIndex(h => h.timestamp === todayLabel);
      if (index !== -1) {
        const updated = [...prev];
        updated[index] = { ...updated[index], revenue: updated[index].revenue + finalBill };
        return updated;
      }
      return prev;
    });

    // Update Bed Inventory - Mark as cleaning
    setBeds(prev => prev.map(b => b.id === dischargeTargetBed.id ? { ...b, status: BedStatus.CLEANING, patient: undefined } : b));
    setIsDischargeModalOpen(false);
    setDischargeTargetBed(null);
  };

  const handleDischargeRequest = (bed: Bed) => {
    setDischargeTargetBed(bed);
    setIsDischargeModalOpen(true);
  };

  const handleSavePatient = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBed) return;
    const target = e.target as any;
    
    const isUpdate = !!selectedBed.patient;

    const newPatient: Patient = {
      id: isUpdate ? selectedBed.patient!.id : (target.patientId.value || `PAT-${Math.floor(Math.random()*100000)}`),
      name: target.patientName.value,
      diagnosis: target.diagnosis.value,
      medications: target.medications.value.split(',').map((m: string) => m.trim()).filter((m: string) => m.length > 0),
      // admissionDate is now editable and defaults to today or existing value
      admissionDate: target.admissionDate.value || (isUpdate ? selectedBed.patient!.admissionDate : new Date().toISOString().split('T')[0]),
      currentBill: parseInt(target.currentBill.value) || (isUpdate ? selectedBed.patient!.currentBill : selectedBed.dailyRate)
    };

    setBeds(prev => prev.map(b => b.id === selectedBed.id ? { ...b, status: BedStatus.OCCUPIED, patient: newPatient } : b));
    setIsModalOpen(false);
    setSelectedBed(null);
  };

  // Personnel Management
  const handleAddUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUser.username || !newUser.password || !newUser.fullName) return alert("Fill all fields.");
    if (users.find(u => u.username === newUser.username)) return alert("Username already exists.");

    const user: User = {
      id: Math.random().toString(36).substr(2, 9),
      ...newUser
    };
    setUsers(prev => [...prev, user]);
    setNewUser({ username: '', password: '', fullName: '', role: 'Staff' });
    alert("New member added successfully.");
  };

  const handleRemoveUser = (id: string) => {
    if (id === '1') return alert("Cannot remove root admin.");
    if (id === currentUser?.id) return alert("Cannot remove yourself.");
    if (window.confirm("Remove this user?")) {
      setUsers(prev => prev.filter(u => u.id !== id));
    }
  };

  // Analytics
  const generateReport = async () => {
    setIsLoadingReport(true);
    try {
      const data = await generateOccupancyReport(beds);
      setReport(data);
    } catch (e) { alert("AI Service Unavailable."); }
    finally { setIsLoadingReport(false); }
  };

  const downloadRegistryBackup = () => {
    const backup = {
      inventory: beds,
      archive: dischargeHistory,
      yield_logs: historyData,
      export_timestamp: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `medtrack_db_export_${new Date().getTime()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="w-full max-w-md bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-200">
          <div className="bg-slate-50 p-8 text-center border-b border-slate-100">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-2xl mb-4 text-blue-600">
              <i className="fas fa-hospital text-3xl"></i>
            </div>
            <h1 className="text-2xl font-bold text-slate-900">MedTrack Login</h1>
          </div>
          <form onSubmit={handleLogin} className="p-8 space-y-6">
            <div>
              <label className="block text-sm font-semibold text-slate-800 mb-2">Access ID</label>
              <input name="username" type="text" required className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500/20 outline-none text-black font-semibold" placeholder="Username" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-800 mb-2">Passkey</label>
              <input name="password" type="password" required className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500/20 outline-none text-black font-semibold" placeholder="••••••••" />
            </div>
            {loginError && <p className="text-rose-600 text-sm font-bold text-center"><i className="fas fa-exclamation-circle mr-2"></i>{loginError}</p>}
            <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-blue-500/20">Authorize Access</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[#f8fafc]">
      <aside className="w-full md:w-64 bg-white border-r border-slate-200 p-6 flex flex-col shrink-0">
        <div className="flex items-center gap-3 mb-10">
          <div className="bg-blue-600 p-2 rounded-lg"><i className="fas fa-hospital text-xl text-white"></i></div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">MedTrack</h1>
        </div>
        <nav className="space-y-1 flex-1">
          <button onClick={() => setActiveTab('monitor')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'monitor' ? 'bg-blue-50 text-blue-900 font-bold' : 'text-slate-600 hover:bg-slate-50'}`}><i className="fas fa-chart-line w-5"></i><span>Facility Monitor</span></button>
          <button onClick={() => setActiveTab('records')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'records' ? 'bg-blue-50 text-blue-900 font-bold' : 'text-slate-600 hover:bg-slate-50'}`}><i className="fas fa-folder-medical w-5"></i><span>Clinical Archive</span></button>
          <button onClick={() => setActiveTab('reports')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'reports' ? 'bg-blue-50 text-blue-900 font-bold' : 'text-slate-600 hover:bg-slate-50'}`}><i className="fas fa-brain w-5"></i><span>AI Analytics</span></button>
          {currentUser?.role === 'Admin' && <button onClick={() => setActiveTab('users')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'users' ? 'bg-blue-50 text-blue-900 font-bold' : 'text-slate-600 hover:bg-slate-50'}`}><i className="fas fa-shield-halved w-5"></i><span>Admin Control</span></button>}
        </nav>
        <div className="mt-auto pt-6 border-t border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold">{currentUser?.fullName[0]}</div>
            <div className="truncate max-w-[100px] text-slate-900 font-semibold text-sm">{currentUser?.fullName}</div>
          </div>
          <button onClick={handleLogout} className="p-2 text-slate-400 hover:text-rose-600"><i className="fas fa-sign-out-alt"></i></button>
        </div>
      </aside>

      <main className="flex-1 p-6 md:p-10 overflow-y-auto">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">
              {activeTab === 'monitor' ? 'Facility Overview' : 
               activeTab === 'records' ? 'Clinical Archive Database' : 
               activeTab === 'reports' ? 'Performance Insights' : 'Registry Management'}
            </h2>
          </div>
          {activeTab === 'monitor' && (
            <div className="bg-emerald-50 border border-emerald-100 px-5 py-3 rounded-2xl shadow-sm text-center">
              <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-1">Session Yield</p>
              <p className="text-xl font-bold text-emerald-900">₹{sessionRevenue.toLocaleString()}</p>
            </div>
          )}
        </header>

        {activeTab === 'monitor' && (
          <div className="space-y-8">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200"><p className="text-slate-500 text-[10px] font-bold uppercase mb-1">Occupancy</p><h3 className="text-2xl font-bold text-slate-900">{stats.occupancyRate}%</h3></div>
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200"><p className="text-rose-600 text-[10px] font-bold uppercase mb-1">Active</p><h3 className="text-2xl font-bold text-slate-900">{stats.occupied}</h3></div>
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200"><p className="text-emerald-600 text-[10px] font-bold uppercase mb-1">Available</p><h3 className="text-2xl font-bold text-slate-900">{stats.available}</h3></div>
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200"><p className="text-amber-600 text-[10px] font-bold uppercase mb-1">Sanitizing</p><h3 className="text-2xl font-bold text-slate-900">{stats.cleaning}</h3></div>
            </div>

            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
               <h3 className="font-bold text-lg text-slate-900 mb-6">Revenue Trends (7D View)</h3>
               <OccupancyChart data={historyData} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {beds.filter(b => filterDept === 'All' || b.department === filterDept).map(bed => (
                <BedCard key={bed.id} bed={bed} onStatusChange={handleStatusChange} onViewDetails={(b) => { setSelectedBed(b); setIsModalOpen(true); }} onDischarge={handleDischargeRequest} />
              ))}
            </div>
          </div>
        )}

        {activeTab === 'records' && (
          <div className="space-y-6">
             <div className="bg-white p-1 rounded-2xl shadow-sm border border-slate-200 inline-flex">
                <button onClick={() => setRecordsSubTab('active')} className={`px-6 py-2 rounded-xl text-sm font-bold ${recordsSubTab === 'active' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500'}`}>Active Cases</button>
                <button onClick={() => setRecordsSubTab('archived')} className={`px-6 py-2 rounded-xl text-sm font-bold ${recordsSubTab === 'archived' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500'}`}>JSON Archive</button>
             </div>

             <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
                <table className="w-full">
                  <thead className="bg-slate-50">
                    <tr className="text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                      <th className="px-6 py-4">Identity</th>
                      <th className="px-6 py-4">Case History</th>
                      <th className="px-6 py-4 text-right">Settlement</th>
                      <th className="px-6 py-4 text-center">Data Inspection</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(recordsSubTab === 'active' ? activePatients : dischargeHistory).length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-6 py-12 text-center text-slate-500 italic text-sm">No clinical records found in registry.</td>
                      </tr>
                    ) : (
                      (recordsSubTab === 'active' ? activePatients : dischargeHistory).map((p, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-4">
                            <p className="text-sm font-bold text-black">{p.name}</p>
                            <p className="text-[10px] font-mono text-slate-500">{p.id}</p>
                          </td>
                          <td className="px-6 py-4">
                            <p className="text-xs font-bold text-blue-700">{p.diagnosis}</p>
                            <p className="text-[10px] text-black font-semibold">Admit: {p.admissionDate} {(p as any).dischargeDate ? `• Exit: ${(p as any).dischargeDate}` : ''}</p>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <p className="font-bold text-black">₹{p.currentBill.toLocaleString()}</p>
                            {(p as any).stayDuration && <p className="text-[10px] font-bold text-emerald-700">{ (p as any).stayDuration } Days duration</p>}
                          </td>
                          <td className="px-6 py-4 text-center">
                            <button 
                              onClick={() => { setSelectedArchiveRecord(p as any); setIsArchiveModalOpen(true); }} 
                              className="text-[10px] font-bold bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-200 text-black shadow-sm"
                            >
                              <i className="fas fa-code mr-1"></i> Inspect JSON
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
             </div>
          </div>
        )}

        {activeTab === 'users' && currentUser?.role === 'Admin' && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
                <h3 className="font-bold text-slate-900 mb-6 flex items-center gap-2">
                  <i className="fas fa-user-plus text-blue-600"></i>
                  Register Facility Personnel
                </h3>
                <form onSubmit={handleAddUser} className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Full Name</label>
                    <input 
                      type="text" 
                      required
                      value={newUser.fullName}
                      onChange={(e) => setNewUser({...newUser, fullName: e.target.value})}
                      className="w-full px-4 py-2 border border-slate-300 rounded-xl text-sm text-black font-semibold" 
                      placeholder="Medical Practitioner Name" 
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Login ID</label>
                      <input 
                        type="text" 
                        required
                        value={newUser.username}
                        onChange={(e) => setNewUser({...newUser, username: e.target.value})}
                        className="w-full px-4 py-2 border border-slate-300 rounded-xl text-sm text-black font-semibold" 
                        placeholder="username" 
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Access Key</label>
                      <input 
                        type="password" 
                        required
                        value={newUser.password}
                        onChange={(e) => setNewUser({...newUser, password: e.target.value})}
                        className="w-full px-4 py-2 border border-slate-300 rounded-xl text-sm text-black font-semibold" 
                        placeholder="••••••••" 
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Privilege Level</label>
                    <select 
                      value={newUser.role}
                      onChange={(e) => setNewUser({...newUser, role: e.target.value as UserRole})}
                      className="w-full px-4 py-2 border border-slate-300 rounded-xl text-sm text-black font-semibold"
                    >
                      <option value="Staff">Clinical Staff</option>
                      <option value="Admin">System Administrator</option>
                    </select>
                  </div>
                  <button type="submit" className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl shadow-lg hover:bg-blue-700 transition-colors">
                    Authorize & Commit
                  </button>
                </form>
              </div>

              <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                <h3 className="font-bold text-slate-900 mb-6 flex items-center gap-2">
                  <i className="fas fa-users-cog text-emerald-600"></i>
                  Active Access Registry
                </h3>
                <div className="flex-1 overflow-y-auto max-h-[400px]">
                  <ul className="divide-y divide-slate-100">
                    {users.map((u) => (
                      <li key={u.id} className="py-4 flex justify-between items-center group">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center font-bold text-blue-700">
                            {u.fullName[0]}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-black">{u.fullName}</p>
                            <p className="text-[10px] text-slate-500 uppercase font-bold">{u.username} • {u.role}</p>
                          </div>
                        </div>
                        <button 
                          onClick={() => handleRemoveUser(u.id)}
                          className="opacity-0 group-hover:opacity-100 p-2 text-slate-400 hover:text-rose-600 transition-all"
                          title="Revoke Personnel Access"
                        >
                          <i className="fas fa-user-slash"></i>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-6 items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900">Medical Data Controls</h3>
                <p className="text-sm text-slate-500 italic">Manage the clinical database records and archives.</p>
              </div>
              <div className="flex gap-4">
                <button onClick={downloadRegistryBackup} className="px-6 py-2.5 bg-slate-50 border border-slate-200 text-black font-bold rounded-xl text-sm hover:bg-slate-100 transition-colors shadow-sm">
                  <i className="fas fa-file-export mr-2"></i> Export Clinical JSON
                </button>
                <button onClick={() => { if(confirm("This will permanently wipe ALL patients and archives. Continue?")) dbService.clearAll(); }} className="px-6 py-2.5 bg-rose-50 border border-rose-100 text-rose-700 font-bold rounded-xl text-sm hover:bg-rose-100 transition-colors shadow-sm">
                  <i className="fas fa-database mr-2"></i> Factory Reset
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'reports' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-bold text-slate-900">AI Medical Intelligence</h3>
              <button 
                onClick={generateReport} 
                disabled={isLoadingReport}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-6 rounded-xl shadow-lg transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {isLoadingReport ? <i className="fas fa-circle-notch fa-spin"></i> : <i className="fas fa-wand-sparkles"></i>}
                {isLoadingReport ? 'Processing Data...' : 'Generate Clinical Insights'}
              </button>
            </div>

            {!report && !isLoadingReport && (
              <div className="bg-white p-20 rounded-3xl border border-dashed border-slate-300 text-center">
                <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <i className="fas fa-robot text-2xl"></i>
                </div>
                <h4 className="text-lg font-bold text-slate-900 mb-2">Predictive Analysis Ready</h4>
                <p className="text-slate-500 max-w-sm mx-auto">Analyze current hospital pressure and departmental flow based on live patient records.</p>
              </div>
            )}

            {report && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
                  <h4 className="text-2xl font-bold text-black mb-4">{report.title}</h4>
                  <p className="text-slate-700 leading-relaxed mb-8">{report.summary}</p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {report.insights.map((insight: any, idx: number) => (
                      <div key={idx} className="bg-slate-50 p-6 rounded-2xl border border-slate-100 flex flex-col hover:bg-white hover:shadow-md transition-all">
                        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-md uppercase mb-4 w-fit ${
                          insight.priority === 'High' ? 'bg-rose-100 text-rose-700' : 'bg-blue-100 text-blue-700'
                        }`}>{insight.priority} Priority</span>
                        <h5 className="font-bold text-black mb-2">{insight.title}</h5>
                        <p className="text-xs text-slate-600 mb-4 flex-1">{insight.content}</p>
                        <p className="text-xs font-bold text-blue-900 mt-auto pt-4 border-t border-slate-200">Recommendation: {insight.recommendation}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* MODAL: ADMISSION / UPDATE */}
        {isModalOpen && selectedBed && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden animate-in zoom-in duration-200 shadow-2xl">
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <h3 className="font-bold text-slate-900">{selectedBed.patient ? 'Modify Patient Details' : 'New Admission Protocol'}: {selectedBed.number}</h3>
                <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-rose-600 transition-colors"><i className="fas fa-times"></i></button>
              </div>
              <form onSubmit={handleSavePatient} className="p-8 space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Patient Full Name</label>
                  <input name="patientName" defaultValue={selectedBed.patient?.name} required className="w-full px-4 py-2 bg-slate-50 border border-slate-300 rounded-xl text-black font-semibold focus:ring-2 focus:ring-blue-500/20 outline-none" placeholder="Identity of patient" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Diagnosis</label>
                    <input name="diagnosis" defaultValue={selectedBed.patient?.diagnosis} required className="w-full px-4 py-2 bg-slate-50 border border-slate-300 rounded-xl text-black font-semibold focus:ring-2 focus:ring-blue-500/20 outline-none" placeholder="Primary reason" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Date of Joining</label>
                    <input name="admissionDate" type="date" defaultValue={selectedBed.patient?.admissionDate || new Date().toISOString().split('T')[0]} required className="w-full px-4 py-2 bg-slate-50 border border-slate-300 rounded-xl text-black font-semibold focus:ring-2 focus:ring-blue-500/20 outline-none" />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Active Prescriptions</label>
                  <textarea name="medications" defaultValue={selectedBed.patient?.medications.join(', ')} className="w-full px-4 py-2 bg-slate-50 border border-slate-300 rounded-xl h-24 text-black font-semibold focus:ring-2 focus:ring-blue-500/20 outline-none" placeholder="Medications (comma-separated)" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Registry UUID</label>
                    <input name="patientId" defaultValue={selectedBed.patient?.id} readOnly={!!selectedBed.patient} className="px-4 py-2 bg-slate-100 border border-slate-300 rounded-xl w-full text-slate-700 font-mono text-xs" placeholder="Auto-generated" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Current Billing (₹)</label>
                    <input name="currentBill" type="number" defaultValue={selectedBed.patient?.currentBill || selectedBed.dailyRate} className="px-4 py-2 bg-slate-50 border border-slate-300 rounded-xl w-full text-black font-bold focus:ring-2 focus:ring-blue-500/20 outline-none" placeholder="Financials" />
                  </div>
                </div>
                <button type="submit" className="w-full bg-blue-700 text-white font-bold py-3.5 rounded-xl shadow-lg hover:bg-blue-800 transition-colors mt-4">
                  {selectedBed.patient ? 'Save & Commit Updates' : 'Authorize Admission'}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: DISCHARGE */}
        {isDischargeModalOpen && dischargeTargetBed && dischargeTargetBed.patient && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-md">
            <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden animate-in zoom-in duration-200 shadow-2xl border border-emerald-100">
              <div className="p-6 border-b border-emerald-50 flex justify-between items-center bg-emerald-50/30">
                <h3 className="font-bold text-emerald-900 flex items-center gap-2">
                   <i className="fas fa-check-double text-emerald-600"></i>
                   Clinical Discharge Protocol: {dischargeTargetBed.number}
                </h3>
                <button onClick={() => setIsDischargeModalOpen(false)} className="text-slate-400 hover:text-rose-600 transition-colors"><i className="fas fa-times"></i></button>
              </div>
              <form onSubmit={finalizeDischarge} className="p-8 space-y-4">
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl mb-2">
                  <p className="text-xs text-slate-500 font-bold mb-1 uppercase tracking-tight">Active Patient</p>
                  <p className="text-sm text-black font-bold">{dischargeTargetBed.patient.name}</p>
                  <p className="text-[10px] text-blue-700 font-bold mt-1">Join Date: {dischargeTargetBed.patient.admissionDate}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Date of Discharge</label>
                    <input name="dischargeDate" type="date" defaultValue={new Date().toISOString().split('T')[0]} required className="w-full px-4 py-2 bg-white border border-slate-300 rounded-xl text-black font-semibold focus:ring-2 focus:ring-emerald-500/20 outline-none" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Final Settlement (₹)</label>
                    <input name="finalBill" type="number" defaultValue={dischargeTargetBed.patient.currentBill} required className="w-full px-4 py-2 bg-white border border-slate-300 rounded-xl text-black font-bold focus:ring-2 focus:ring-emerald-500/20 outline-none" />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Discharge Summary & JSON Archive Note</label>
                  <textarea name="summary" required className="w-full px-4 py-2 bg-white border border-slate-300 rounded-xl h-24 text-black font-medium focus:ring-2 focus:ring-emerald-500/20 outline-none" placeholder="Provide summary for medical records" defaultValue="Condition stable. Advised follow-up in 7 days." />
                </div>
                <button type="submit" className="w-full bg-emerald-600 text-white font-bold py-4 rounded-xl shadow-lg hover:bg-emerald-700 transition-colors mt-4">
                  Archive Clinical Data & Release Bed
                </button>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: JSON INSPECTOR */}
        {isArchiveModalOpen && selectedArchiveRecord && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/90 backdrop-blur-xl">
            <div className="bg-[#020617] rounded-3xl w-full max-w-2xl overflow-hidden border border-slate-800 shadow-2xl animate-in zoom-in duration-200">
              <div className="p-6 border-b border-slate-800 flex justify-between items-center text-white">
                <h3 className="font-bold font-mono tracking-tight text-blue-400"><i className="fas fa-terminal mr-2"></i>Data Registry Inspect: {selectedArchiveRecord.id}</h3>
                <button onClick={() => setIsArchiveModalOpen(false)} className="hover:text-rose-500 transition-colors"><i className="fas fa-times"></i></button>
              </div>
              <div className="p-8">
                <div className="grid grid-cols-2 gap-6 mb-8">
                  <div className="p-4 bg-slate-900/50 rounded-xl border border-slate-800">
                    <p className="text-[10px] font-bold text-slate-500 uppercase mb-2">Internal Case Summary</p>
                    <p className="text-slate-200 text-sm font-medium italic leading-relaxed">"{selectedArchiveRecord.dischargeSummary}"</p>
                  </div>
                  <div className="p-4 bg-slate-900/50 rounded-xl border border-slate-800">
                    <p className="text-[10px] font-bold text-slate-500 uppercase mb-2">Archival Metrics</p>
                    <p className="text-emerald-400 text-sm font-bold">Total Duration: {selectedArchiveRecord.stayDuration} Days</p>
                    <p className="text-blue-400 text-sm font-bold">Total Settlement: ₹{selectedArchiveRecord.currentBill.toLocaleString()}</p>
                    <p className="text-slate-500 text-[10px] font-mono mt-2">Closed: {selectedArchiveRecord.dischargeDate}</p>
                  </div>
                </div>
                <div className="relative group">
                   <div className="absolute top-3 right-3 flex gap-2">
                    <span className="text-[10px] bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded border border-emerald-500/20 font-bold uppercase">Clinical JSON</span>
                  </div>
                  <pre className="bg-[#0f172a] p-6 rounded-2xl overflow-y-auto text-[11px] text-blue-300 font-mono border border-slate-800 max-h-[350px] scrollbar-thin scrollbar-thumb-slate-700">
                    {JSON.stringify(selectedArchiveRecord, null, 2)}
                  </pre>
                </div>
                <div className="mt-8 flex justify-end">
                  <button onClick={() => setIsArchiveModalOpen(false)} className="bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 px-10 rounded-xl transition-all border border-slate-700 shadow-lg">Close Archive</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
