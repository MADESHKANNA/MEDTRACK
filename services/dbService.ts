
import { Bed, DischargedPatient, User, OccupancyLog } from '../types';
import { INITIAL_BEDS, MOCK_HISTORY, MOCK_DISCHARGE_HISTORY } from '../constants';

const DB_KEYS = {
  BEDS: 'medtrack_beds',
  HISTORY: 'medtrack_history',
  USERS: 'medtrack_users',
  REVENUE: 'medtrack_session_revenue',
  STATS: 'medtrack_stats_history'
};

export const dbService = {
  saveBeds: (beds: Bed[]) => {
    localStorage.setItem(DB_KEYS.BEDS, JSON.stringify(beds));
  },
  
  loadBeds: (): Bed[] => {
    const saved = localStorage.getItem(DB_KEYS.BEDS);
    return saved ? JSON.parse(saved) : INITIAL_BEDS;
  },

  saveHistory: (history: DischargedPatient[]) => {
    localStorage.setItem(DB_KEYS.HISTORY, JSON.stringify(history));
  },

  loadHistory: (): DischargedPatient[] => {
    const saved = localStorage.getItem(DB_KEYS.HISTORY);
    // Modified to return empty array as requested for starting state
    return saved ? JSON.parse(saved) : [];
  },

  saveUsers: (users: User[]) => {
    localStorage.setItem(DB_KEYS.USERS, JSON.stringify(users));
  },

  loadUsers: (defaultAdmin: User): User[] => {
    const saved = localStorage.getItem(DB_KEYS.USERS);
    return saved ? JSON.parse(saved) : [defaultAdmin];
  },

  saveRevenue: (revenue: number) => {
    localStorage.setItem(DB_KEYS.REVENUE, revenue.toString());
  },

  loadRevenue: (): number => {
    const saved = localStorage.getItem(DB_KEYS.REVENUE);
    return saved ? parseInt(saved, 10) : 0;
  },

  saveStatsHistory: (history: OccupancyLog[]) => {
    localStorage.setItem(DB_KEYS.STATS, JSON.stringify(history));
  },

  loadStatsHistory: (): OccupancyLog[] => {
    const saved = localStorage.getItem(DB_KEYS.STATS);
    return saved ? JSON.parse(saved) : MOCK_HISTORY;
  },

  clearAll: () => {
    localStorage.clear();
    window.location.reload();
  }
};
