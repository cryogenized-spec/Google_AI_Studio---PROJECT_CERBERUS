
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw, Trash2 } from 'lucide-react';
import Dexie from 'dexie';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class GlobalErrorBoundary extends Component<Props, State> {
  public state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Critical Application Error:", error, errorInfo);
    
    // CRITICAL FIX 1: Force remove splash screen immediately
    const splash = document.getElementById('splash-screen');
    if (splash) {
        splash.style.display = 'none'; // Immediate hide
    }

    // CRITICAL FIX 2: Force Root Visibility
    // The boot sequence keeps root at opacity 0 until ready.
    // If we crash before that, we must force it visible to show the error.
    const root = document.getElementById('root');
    if (root) {
        root.classList.add('booted');
        root.style.opacity = '1';
    }

    document.body.style.overflow = 'auto';
  }

  handleHardReset = async () => {
    if (confirm("WARNING: This will wipe all local data (chats, characters, settings, organizer) to fix the crash. This cannot be undone. Continue?")) {
        localStorage.clear();
        try {
            // Attempt to delete databases
            const dbs = await window.indexedDB.databases();
            dbs.forEach(db => {
                if (db.name) window.indexedDB.deleteDatabase(db.name);
            });
        } catch (e) {
            console.error("Failed to delete DB", e);
        }
        window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#1a0505] text-red-100 flex flex-col items-center justify-center p-6 font-mono text-center z-[10000] relative">
          <div className="bg-black/80 p-8 rounded-xl border border-red-800 max-w-lg w-full shadow-[0_0_50px_rgba(220,38,38,0.2)] backdrop-blur-md">
            <AlertCircle size={48} className="mx-auto text-red-500 mb-4 animate-pulse" />
            <h1 className="text-2xl font-bold mb-2 text-white font-serif tracking-widest">SYSTEM CRITICAL FAILURE</h1>
            <p className="text-xs text-red-300 mb-6 uppercase tracking-widest opacity-80">
                The core logic has encountered an unrecoverable exception.
            </p>
            
            <div className="bg-black p-4 rounded border border-red-900/50 text-left mb-6 overflow-auto max-h-32 custom-scrollbar">
                <code className="text-[10px] text-red-400 break-all font-mono">
                    {this.state.error?.message || "Unknown Error"}
                </code>
            </div>

            <div className="space-y-3">
                <button 
                    onClick={() => window.location.reload()}
                    className="w-full py-3 bg-red-900 hover:bg-red-800 text-white rounded font-bold uppercase text-xs flex items-center justify-center gap-2 transition-colors shadow-lg"
                >
                    <RefreshCw size={14}/> Attempt Reboot
                </button>
                <button 
                    onClick={this.handleHardReset}
                    className="w-full py-3 bg-transparent border border-red-800 text-red-400 hover:text-white hover:bg-red-900/50 rounded font-bold uppercase text-xs flex items-center justify-center gap-2 transition-colors"
                >
                    <Trash2 size={14}/> Factory Reset (Wipe Data)
                </button>
            </div>
            
            <p className="mt-6 text-[9px] text-gray-500">
                If this persists, the local state is likely corrupted. Use Factory Reset.
            </p>
          </div>
        </div>
      );
    }

    // @ts-ignore - Explicitly ignore TS checking on props for Component inheritance edge cases
    return this.props.children; 
  }
}
