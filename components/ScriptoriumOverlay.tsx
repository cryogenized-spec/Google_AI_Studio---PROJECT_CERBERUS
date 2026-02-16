
import React from 'react';
import { X, MoreVertical, Trash2, Bell, Download, Upload } from 'lucide-react';
import { ScriptoriumConfig, Message } from '../types';
import OrganizerCore from './OrganizerCore';
import { initializeOrganizer, exportOrganizerData, importOrganizerData, requestPersistentStorage } from '../services/organizerDb';

interface ScriptoriumOverlayProps {
    isOpen: boolean;
    onClose: () => void;
    messages: Message[]; // Kept for interface compat, but unused now in new core
    config: ScriptoriumConfig;
    isStreaming: boolean;
    onSendMessage: (content: string) => void;
    onUpdateConfig: (newConfig: ScriptoriumConfig) => void;
    onClearMessages: () => void;
    onStopGeneration: () => void;
    enterToSend: boolean;
    onManualPing: () => void;
    apiKeyOpenAI?: string;
    apiKeyGemini?: string;
    vttMode?: 'browser' | 'openai' | 'gemini';
    vttAutoSend?: boolean;
    transcriptionModel?: string;
}

const ScriptoriumOverlay: React.FC<ScriptoriumOverlayProps> = ({
    isOpen, onClose
}) => {
    // Init DB on first mount
    React.useEffect(() => {
        initializeOrganizer();
        requestPersistentStorage();
    }, []);

    const handleExport = async () => {
        const json = await exportOrganizerData();
        const blob = new Blob([json], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `organizer_backup_${Date.now()}.json`;
        link.click();
    };

    const handleImport = async () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'application/json';
        input.onchange = async (e: any) => {
            const file = e.target.files[0];
            if (!file) return;
            const text = await file.text();
            try {
                await importOrganizerData(text);
                alert("Import Successful");
            } catch (err) {
                alert("Import Failed");
            }
        };
        input.click();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] bg-cerberus-900 flex flex-col animate-fadeIn font-sans">
            
            {/* Minimal Header */}
            <div className="h-12 bg-cerberus-900 border-b border-cerberus-800 flex items-center justify-between px-4 shrink-0">
                <div className="flex items-center gap-3">
                    <span className="text-cerberus-accent font-serif font-bold tracking-widest text-sm">EBON SCRIPTORIUM</span>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={handleExport} className="p-2 text-gray-500 hover:text-white" title="Export Backup"><Download size={16}/></button>
                    <button onClick={handleImport} className="p-2 text-gray-500 hover:text-white" title="Import Backup"><Upload size={16}/></button>
                    <button onClick={onClose} className="p-2 text-gray-500 hover:text-red-500"><X size={20}/></button>
                </div>
            </div>

            {/* Core App */}
            <div className="flex-1 relative overflow-hidden">
                <OrganizerCore />
            </div>
        </div>
    );
};

export default ScriptoriumOverlay;
