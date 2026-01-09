import React from 'react';
import { Bed, BedStatus } from '../types';

interface BedCardProps {
  bed: Bed;
  onStatusChange: (id: string, status: BedStatus) => void;
  onViewDetails: (bed: Bed) => void;
  onDischarge: (bed: Bed) => void;
}

const BedCard: React.FC<BedCardProps> = ({ bed, onStatusChange, onViewDetails, onDischarge }) => {
  const getStatusStyles = (status: BedStatus) => {
    switch (status) {
      case BedStatus.AVAILABLE: return 'bg-emerald-50 border-emerald-200 text-emerald-900';
      case BedStatus.OCCUPIED: return 'bg-rose-50 border-rose-200 text-rose-900';
      case BedStatus.CLEANING: return 'bg-amber-50 border-amber-200 text-amber-900';
      case BedStatus.MAINTENANCE: return 'bg-slate-50 border-slate-200 text-slate-900';
      default: return 'bg-gray-50 border-gray-200 text-gray-900';
    }
  };

  const getStatusIcon = (status: BedStatus) => {
    switch (status) {
      case BedStatus.AVAILABLE: return 'fa-check-circle';
      case BedStatus.OCCUPIED: return 'fa-bed';
      case BedStatus.CLEANING: return 'fa-broom';
      case BedStatus.MAINTENANCE: return 'fa-tools';
    }
  };

  return (
    <div className={`p-4 rounded-xl border-2 transition-all duration-200 ${getStatusStyles(bed.status)} flex flex-col h-full shadow-sm hover:shadow-md`}>
      <div className="flex justify-between items-start mb-3">
        <div>
          <h3 className="font-bold text-lg text-slate-900">{bed.number}</h3>
          <p className="text-[10px] font-bold opacity-80 uppercase tracking-wider text-slate-600">{bed.department}</p>
        </div>
        <div className="flex items-center gap-2">
          {bed.status === BedStatus.OCCUPIED && (
             <button 
               onClick={() => onDischarge(bed)}
               className="w-8 h-8 flex items-center justify-center bg-rose-100 text-rose-900 rounded-lg hover:bg-rose-200 transition-colors border border-rose-200 shadow-sm"
               title="Discharge Patient"
             >
               <i className="fas fa-sign-out-alt text-xs"></i>
             </button>
          )}
          <i className={`fas ${getStatusIcon(bed.status)} text-xl opacity-40 text-slate-600`}></i>
        </div>
      </div>

      <div className="space-y-3 mb-4 flex-1">
        {bed.status === BedStatus.OCCUPIED && bed.patient ? (
          <div className="space-y-2">
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase">Patient</p>
              <p className="text-sm font-bold text-slate-900 truncate">{bed.patient.name}</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-[10px] font-bold text-slate-500 uppercase">Diagnosis</p>
                <p className="text-xs font-semibold text-slate-800 truncate" title={bed.patient.diagnosis}>{bed.patient.diagnosis}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-500 uppercase">Bill</p>
                <p className="text-xs font-bold text-rose-700">₹{bed.patient.currentBill.toLocaleString()}</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="py-4 text-center">
            <p className="text-xs font-semibold italic text-slate-500">
              {bed.status === BedStatus.AVAILABLE ? 'Ready for Admission' : 
               bed.status === BedStatus.CLEANING ? 'Undergoing Sanitation' : 'Maintenance Required'}
            </p>
          </div>
        )}
      </div>

      <div className="space-y-2 pt-2 border-t border-slate-200">
        <button 
          onClick={() => onViewDetails(bed)}
          className={`w-full text-xs font-bold py-2 rounded-lg transition-all ${
            bed.status === BedStatus.OCCUPIED 
            ? 'bg-rose-100 hover:bg-rose-200 text-rose-900 border border-rose-200' 
            : 'bg-blue-100 hover:bg-blue-200 text-blue-900 border border-blue-200'
          }`}
        >
          {bed.status === BedStatus.OCCUPIED ? 'Update Record' : 'Admit Patient'}
        </button>
        <div className="relative">
          <select
            value={bed.status}
            onChange={(e) => onStatusChange(bed.id, e.target.value as BedStatus)}
            className="w-full bg-slate-50 border border-slate-200 rounded-lg py-1.5 px-2 text-[10px] font-bold uppercase tracking-wider focus:outline-none focus:ring-2 focus:ring-blue-500/20 appearance-none cursor-pointer text-slate-900"
          >
            {Object.values(BedStatus).map(status => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
          <i className="fas fa-chevron-down absolute right-2 top-1/2 -translate-y-1/2 text-[8px] pointer-events-none opacity-40 text-slate-600"></i>
        </div>
      </div>
    </div>
  );
};

export default BedCard;