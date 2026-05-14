import React from 'react';
import { useApp } from '../../contexts/AppContext';
import { motion } from 'motion/react';

export default function LoadingScreen() {
  const { fetchError, loadingStatus } = useApp();

  return (
    <div className="fixed inset-0 bg-slate-50 flex items-center justify-center z-[9999]">
      <div className="w-full max-w-sm px-8 text-center">
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-indigo-200 mb-6">
             <i className="ti ti-layout-kanban text-white text-3xl"></i>
          </div>
          <h1 className="text-xl font-bold text-slate-900 mb-2">Project Workspace</h1>
          <p className="text-slate-500 text-sm">Getting everything ready for you</p>
        </motion.div>

        {!fetchError ? (
          <div className="space-y-4">
            <div className="flex justify-between items-center text-[11px] font-bold text-slate-400 uppercase tracking-widest px-1">
              <span>{loadingStatus}</span>
              <span className="flex gap-1 animate-pulse">
                <span className="w-1 h-1 bg-indigo-400 rounded-full"></span>
                <span className="w-1 h-1 bg-indigo-400 rounded-full"></span>
                <span className="w-1 h-1 bg-indigo-400 rounded-full"></span>
              </span>
            </div>
            <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
               <motion.div 
                 className="h-full bg-indigo-600"
                 initial={{ width: "2%" }}
                 animate={{ width: "95%" }}
                 transition={{ duration: 15, ease: "linear" }}
               ></motion.div>
            </div>
            <p className="text-[10px] text-slate-400 italic">
              This might take a moment if the database is in a cold state.
            </p>
          </div>
        ) : (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="p-4 bg-red-50 border border-red-100 rounded-xl text-left"
          >
            <div className="flex items-center gap-2 text-red-700 font-bold text-xs mb-1">
              <i className="ti ti-alert-circle"></i> Connection Delay
            </div>
            <p className="text-red-600 text-xs leading-relaxed mb-4">{fetchError}</p>
            <button 
              onClick={() => window.location.reload()}
              className="w-full py-2 bg-red-600 text-white rounded-lg text-xs font-bold hover:bg-red-700 transition-colors"
            >
              Retry Connection
            </button>
          </motion.div>
        )}
      </div>
    </div>
  );
}
