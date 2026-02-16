import React, { useState, useEffect, useRef } from 'react';
import { X, CheckCircle, AlertCircle, Save, Plus, Trash2, Github, Sliders, Lock, Unlock, Database, ScrollText, Activity, Power, Terminal, Clock, Maximize, Info, User, HardDrive, Download, Upload, Sparkles, Copy, BrainCircuit, AlignJustify, Code, RotateCcw, RotateCw, Loader2, Edit3, Check, Compass, Mic, Radio, ChevronDown, ChevronRight, Image as ImageIcon, Key, FileText, Zap, MessageSquare, Layers, ShieldAlert, Layout, EyeOff, Eye, Smartphone, Shield } from 'lucide-react';
import { AppSettings, CharacterProfile, Room, ChatState, FirebaseConfig, ScriptoriumConfig, DeepLogicConfig, ScheduleSettings, RuntimeSettings, MemoryPolicy, ToolSettings, WakeLog, ProfileSlot, QuickPreset } from '../types';
import { fetchRepositories, performBackup, restoreBackup } from '../services/githubService';
import { fetchSettings, saveSettings, fetchWakeLogs } from '../services/firebaseService';
import { MAPPING_LOGIC_BASIC, MAPPING_LOGIC_ADVANCED } from '../constants';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../services/organizerDb';
import { useLiveQuery } from 'dexie-react-hooks';
import KeyManager from './KeyManager';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  character: CharacterProfile;
  scriptoriumConfig?: ScriptoriumConfig;
  deepLogicConfig: DeepLogicConfig;
  initialTab?: 'api' | 'deeplogic'; 
  onSave: (
      settings: AppSettings, 
      character: CharacterProfile, 
      rooms?: Room[], 
      scriptoriumConfig?: ScriptoriumConfig, 
      deepLogicConfig?: DeepLogicConfig
  ) => void;
  onRestore?: (newState: ChatState) => void;
  onExportTxt: () => void; 
  rooms?: Room[];
}

const isDeepEqual = (obj1: any, obj2: any) => JSON.stringify(obj1) === JSON.stringify(obj2);
const PROFILE_STORAGE_KEY = 'project_cerberus_profiles_v1';

// Modified CollapsibleSection to support locking
interface CollapsibleSectionProps {
    title: React.ReactNode;
    isOpen: boolean;
    onToggle: () => void;
    children: React.ReactNode;
    icon?: React.ReactNode;
    isLocked?: boolean;
    onLockToggle?: (e: React.MouseEvent) => void;
}

const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({ title, isOpen, onToggle, children, icon, isLocked, onLockToggle }) => (
    <div className="border border-cerberus-800 rounded bg-cerberus-900/30 overflow-hidden mb-4 transition-all">
        <div 
            onClick={onToggle}
            className="w-full flex items-center justify-between p-3 bg-black/20 hover:bg-black/40 transition-colors text-xs font-bold uppercase tracking-widest text-cerberus-accent font-mono cursor-pointer select-none"
        >
            <span className="flex items-center gap-2">{icon} {title}</span>
            <div className="flex items-center gap-3">
                {onLockToggle && (
                    <button 
                        onClick={onLockToggle} 
                        className={`p-1 rounded hover:bg-black/50 transition-colors ${isLocked ? 'text-red-500' : 'text-gray-600 hover:text-gray-300'}`}
                        title={isLocked ? "Section Locked" : "Lock Section"}
                    >
                        {isLocked ? <Lock size={14} /> : <Unlock size={14} />}
                    </button>
                )}
                {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </div>
        </div>
        {isOpen && (
            <div className={`p-4 animate-fadeIn transition-opacity duration-300 ${isLocked ? 'opacity-40 pointer-events-none grayscale-[0.5]' : 'opacity-100'}`}>
                {children}
            </div>
        )}
    </div>
);

interface NumericSettingProps {
    label: React.ReactNode;
    value: number;
    min: number;
    max: number;
    step: number;
    onChange: (val: number) => void;
    suffix?: string;
    isTokenMode?: boolean; 
    icon?: React.ReactNode;
    disabled?: boolean;
    helperText?: string;
}

const NumericSetting: React.FC<NumericSettingProps> = ({ label, value, min, max, step, onChange, suffix = '', isTokenMode = false, icon, disabled, helperText }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editValue, setEditValue] = useState(String(value));
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        setEditValue(String(value));
    }, [value]);

    useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [isEditing]);

    const commitEdit = () => {
        let parsed = parseFloat(editValue);
        if (isNaN(parsed)) parsed = value;
        if (parsed < min) parsed = min;
        if (parsed > max) parsed = max;
        onChange(parsed);
        setIsEditing(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') commitEdit();
    };

    const wordCount = isTokenMode ? `~${Math.floor(value * 0.75)} words` : '';

    return (
        <div className={`group ${disabled ? 'opacity-50 pointer-events-none grayscale' : ''}`}>
            <div className="flex justify-between items-end mb-1">
                <div className="flex items-center gap-2">
                    {icon && <div className="text-cerberus-600">{icon}</div>}
                    <div>
                        <div className="block text-[10px] font-mono text-cerberus-accent uppercase tracking-wider">{label}</div>
                        {helperText && <div className="text-[9px] text-gray-500 leading-tight max-w-[200px]">{helperText}</div>}
                    </div>
                </div>
                {isEditing ? (
                    <input 
                        ref={inputRef}
                        type="number"
                        value={editValue}
                        onChange={e => setEditValue(e.target.value)}
                        onBlur={commitEdit} 
                        onKeyDown={handleKeyDown}
                        className="bg-black border-b border-cerberus-accent text-right w-24 text-cerberus-accent font-bold text-xs focus:outline-none placeholder-gray-700 animate-fadeIn"
                    />
                ) : (
                    <div 
                        onClick={() => !disabled && setIsEditing(true)}
                        className="flex items-center gap-2 cursor-pointer text-gray-500 hover:text-cerberus-accent transition-colors"
                    >
                        {isTokenMode && <span className="text-[9px] opacity-70">{wordCount}</span>}
                        <span className="text-[10px] font-mono border-b border-transparent hover:border-gray-600 pb-0.5">
                            {value}{suffix}
                        </span>
                    </div>
                )}
            </div>
            <input 
                type="range" 
                min={min} 
                max={max} 
                step={step} 
                value={value} 
                onChange={(e) => onChange(parseFloat(e.target.value))} 
                className="w-full cursor-pointer accent-cerberus-accent"
                disabled={disabled}
            />
        </div>
    );
};

const getProviderCapabilities = (settings: AppSettings) => {
    const isGemini = settings.activeProvider === 'gemini';
    const isGrok = settings.activeProvider === 'grok';
    
    return {
        temperature: true,
        topP: true,
        topK: isGemini,
        maxOutputTokens: true,
        stopSequences: true, 
        frequencyPenalty: true,
        presencePenalty: true,
        responseFormat: isGrok, 
    };
};

const SettingsModal: React.FC<SettingsModalProps> = ({ 
    isOpen, onClose, settings: initialSettings, character: initialCharacter, rooms: initialRooms = [], 
    scriptoriumConfig: initialScriptoriumConfig, deepLogicConfig: initialDeepLogicConfig, 
    initialTab, onSave, onRestore, onExportTxt
}) => {
  const [settings, setSettings] = useState<AppSettings>(initialSettings);
  const [character, setCharacter] = useState<CharacterProfile>(initialCharacter);
  const [rooms, setRooms] = useState<Room[]>(initialRooms);
  const [scriptoriumConfig, setScriptoriumConfig] = useState<ScriptoriumConfig>(initialScriptoriumConfig || { backgroundImage: '', systemPrompt: '', tools: { gmail: true, calendar: true, tasks: true, docs: true, keep: true } });
  const [deepLogic, setDeepLogic] = useState<DeepLogicConfig>(initialDeepLogicConfig);
  const [history, setHistory] = useState<string[]>([]); 
  const [future, setFuture] = useState<string[]>([]);
  const [profiles, setProfiles] = useState<ProfileSlot[]>([]);
  const [saveAsInput, setSaveAsInput] = useState('');
  const [showSaveAsConfirm, setShowSaveAsConfirm] = useState<number | null>(null);
  const [logicMode, setLogicMode] = useState<'basic' | 'advanced'>('advanced');
  const [draftBasic, setDraftBasic] = useState(MAPPING_LOGIC_BASIC);
  const [draftAdvanced, setDraftAdvanced] = useState(MAPPING_LOGIC_ADVANCED);
  const [baseState, setBaseState] = useState({ settings: initialSettings, character: initialCharacter, rooms: initialRooms, scriptoriumConfig: initialScriptoriumConfig, deepLogic: initialDeepLogicConfig });
  const [runtime, setRuntime] = useState<RuntimeSettings | null>(null);
  const [schedule, setSchedule] = useState<ScheduleSettings | null>(null);
  const [memoryPolicy, setMemoryPolicy] = useState<MemoryPolicy | null>(null);
  const [tools, setTools] = useState<ToolSettings | null>(null);
  const [logs, setLogs] = useState<WakeLog[]>([]);
  const [isLoadingOps, setIsLoadingOps] = useState(false);
  const [activeTab, setActiveTab] = useState<'api' | 'character' | 'appearance' | 'locations' | 'scriptorium' | 'quickpanel' | 'profiles' | 'backups' | 'deeplogic'>('api');
  const [isSystemUnlocked, setIsSystemUnlocked] = useState(!initialDeepLogicConfig.passwordEnabled);
  const [passwordInput, setPasswordInput] = useState('');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success'>('idle');
  const [repos, setRepos] = useState<string[]>([]);
  const [isFetchingRepos, setIsFetchingRepos] = useState(false);
  const [backupStatus, setBackupStatus] = useState<'idle' | 'uploading' | 'restoring' | 'success' | 'error'>('idle');
  const [backupErrorLog, setBackupErrorLog] = useState<string | null>(null);
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
  const [restoreInput, setRestoreInput] = useState('');
  const [manualRepoInput, setManualRepoInput] = useState(false);
  const [isKeyManagerOpen, setIsKeyManagerOpen] = useState(false);
  
  const [showGithubToken, setShowGithubToken] = useState(false); // NEW

  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);
  const [showAdvancedInference, setShowAdvancedInference] = useState(false);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
      credentials: true,
      inference: true,
      roleplay: true,
      voice: false,
  });
  
  // NEW: Locking State
  const [lockedSections, setLockedSections] = useState<Record<string, boolean>>({});

  const toggleSection = (id: string) => setOpenSections(prev => ({ ...prev, [id]: !prev[id] }));
  const toggleLock = (id: string) => setLockedSections(prev => ({ ...prev, [id]: !prev[id] }));
  
  const capabilities = getProviderCapabilities(settings);

  // Quick Panel Presets
  const quickPresets = useLiveQuery(() => db.quick_presets.toArray()) || [];

  useEffect(() => {
      if (isOpen) {
          if (initialTab) setActiveTab(initialTab);
          setHistory([]);
          setFuture([]);
          loadProfiles();
      }
  }, [isOpen, initialTab]);

  useEffect(() => {
      if (isOpen) {
          setSettings(initialSettings);
          setCharacter(initialCharacter);
          setRooms(initialRooms);
          setDeepLogic(initialDeepLogicConfig);
          if (initialScriptoriumConfig) setScriptoriumConfig(initialScriptoriumConfig);
          setBaseState({ settings: initialSettings, character: initialCharacter, rooms: initialRooms, scriptoriumConfig: initialScriptoriumConfig, deepLogic: initialDeepLogicConfig });
          
          const currentLogic = initialCharacter.mappingLogic || MAPPING_LOGIC_ADVANCED;
          if (currentLogic.includes("SPATIAL LOGIC MODE: BASIC")) {
              setLogicMode('basic'); setDraftBasic(currentLogic); setDraftAdvanced(MAPPING_LOGIC_ADVANCED); 
          } else {
              setLogicMode('advanced'); setDraftAdvanced(currentLogic); setDraftBasic(MAPPING_LOGIC_BASIC);
          }
      }
  }, [isOpen, initialSettings, initialCharacter, initialRooms, initialScriptoriumConfig, initialDeepLogicConfig]);

  useEffect(() => {
      if (activeTab === 'deeplogic' && isSystemUnlocked && !runtime && settings.firebaseConfig?.apiKey) loadOpsData();
  }, [activeTab, isSystemUnlocked]);

  const loadOpsData = async () => {
      setIsLoadingOps(true);
      try {
          const [r, s, m, t, l] = await Promise.all([ fetchSettings('runtime'), fetchSettings('schedule'), fetchSettings('memoryPolicy'), fetchSettings('tools'), fetchWakeLogs(10) ]);
          setRuntime(r); setSchedule(s); setMemoryPolicy(m); setTools(t); setLogs(l);
      } catch (e) { console.error("Failed to load ops data", e); } finally { setIsLoadingOps(false); }
  };

  const saveToHistory = () => {
      const currentState = JSON.stringify({ settings, character, rooms, scriptoriumConfig, deepLogic });
      setHistory(prev => { const newHist = [...prev, currentState]; if (newHist.length > 20) newHist.shift(); return newHist; });
      setFuture([]); 
  };

  const handleUndo = () => {
      if (history.length === 0) return;
      setFuture(prev => [...prev, JSON.stringify({ settings, character, rooms, scriptoriumConfig, deepLogic })]);
      const lastState = JSON.parse(history[history.length - 1]);
      setSettings(lastState.settings); setCharacter(lastState.character); setRooms(lastState.rooms); setScriptoriumConfig(lastState.scriptoriumConfig); setDeepLogic(lastState.deepLogic);
      setHistory(prev => prev.slice(0, -1));
  };

  const handleRedo = () => {
      if (future.length === 0) return;
      setHistory(prev => [...prev, JSON.stringify({ settings, character, rooms, scriptoriumConfig, deepLogic })]);
      const nextState = JSON.parse(future[future.length - 1]);
      setSettings(nextState.settings); setCharacter(nextState.character); setRooms(nextState.rooms); setScriptoriumConfig(nextState.scriptoriumConfig); setDeepLogic(nextState.deepLogic);
      setFuture(prev => prev.slice(0, -1));
  };

  const updateSettings = (newSettings: AppSettings) => { saveToHistory(); setSettings(newSettings); };
  const updateCharacter = (newChar: CharacterProfile) => { saveToHistory(); setCharacter(newChar); };
  const updateRooms = (newRooms: Room[]) => { saveToHistory(); setRooms(newRooms); };
  const updateScriptorium = (newConf: ScriptoriumConfig) => { saveToHistory(); setScriptoriumConfig(newConf); };
  const updateDeepLogic = (newDL: DeepLogicConfig) => { saveToHistory(); setDeepLogic(newDL); };

  const isDirty = !isDeepEqual(settings, baseState.settings) || !isDeepEqual(character, baseState.character) || !isDeepEqual(rooms, baseState.rooms) || !isDeepEqual(scriptoriumConfig, baseState.scriptoriumConfig) || !isDeepEqual(deepLogic, baseState.deepLogic);

  const loadProfiles = () => {
      const stored = localStorage.getItem(PROFILE_STORAGE_KEY);
      if (stored) { setProfiles(JSON.parse(stored)); } else {
          const initSlots: ProfileSlot[] = Array(5).fill(null).map((_, i) => ({ id: i + 1, name: `Slot ${i + 1}`, timestamp: 0, data: null }));
          setProfiles(initSlots); localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(initSlots));
      }
  };

  const handleProfileSaveAs = (slotId: number) => {
      if (saveAsInput !== "Save As Now") { alert("Incorrect confirmation phrase."); return; }
      const newProfiles = profiles.map(p => p.id === slotId ? { ...p, timestamp: Date.now(), data: { settings, character, rooms, scriptoriumConfig, deepLogic } } : p);
      setProfiles(newProfiles); localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(newProfiles));
      setShowSaveAsConfirm(null); setSaveAsInput(''); alert(`Configuration saved to ${newProfiles.find(p => p.id === slotId)?.name}`);
  };

  const handleProfileLoad = (slotId: number) => {
      const slot = profiles.find(p => p.id === slotId);
      if (slot && slot.data) {
          saveToHistory(); setSettings(slot.data.settings); setCharacter(slot.data.character); setRooms(slot.data.rooms); setScriptoriumConfig(slot.data.scriptoriumConfig); setDeepLogic(slot.data.deepLogic);
          alert(`Loaded profile: ${slot.name}`);
      }
  };

  const handleLogicChange = (val: string) => { updateCharacter({...character, mappingLogic: val}); if (logicMode === 'basic') setDraftBasic(val); else setDraftAdvanced(val); };
  const switchLogicMode = (target: 'basic' | 'advanced') => {
      if (target === logicMode) return;
      if (target === 'basic') { setLogicMode('basic'); updateCharacter({...character, mappingLogic: draftBasic}); } 
      else { setLogicMode('advanced'); updateCharacter({...character, mappingLogic: draftAdvanced}); }
  };

  const applyPreset = (type: 'strict' | 'balanced' | 'wild') => {
      saveToHistory();
      const base = { ...settings };
      if (type === 'strict') {
          base.temperature = 0.3; base.topP = 0.8; base.presencePenalty = 0.0; base.frequencyPenalty = 0.0; base.tokenTarget = 200;
          base.roleplayIntensity = 50; base.writingStyle = 'plain'; base.safetyLevel = 'strict';
      } else if (type === 'balanced') {
          base.temperature = 0.9; base.topP = 0.95; base.presencePenalty = 0.2; base.frequencyPenalty = 0.2; base.tokenTarget = 300;
          base.roleplayIntensity = 75; base.writingStyle = 'balanced'; base.safetyLevel = 'standard';
      } else if (type === 'wild') {
          base.temperature = 1.3; base.topP = 0.98; base.presencePenalty = 0.6; base.frequencyPenalty = 0.6; base.tokenTarget = 500;
          base.roleplayIntensity = 90; base.writingStyle = 'ornate'; base.safetyLevel = 'off';
      }
      setSettings(base);
  };

  const handleMaxTokensChange = (val: number) => updateSettings({...settings, maxOutputTokens: val});

  const toggleQuickElement = async (preset: QuickPreset, type: string) => {
      const exists = preset.layout.find(el => el.type === type);
      let newLayout = [...preset.layout];
      if (exists) {
          newLayout = newLayout.filter(el => el.type !== type);
      } else {
          newLayout.push({ id: uuidv4(), type: type as any, size: 'medium' });
      }
      await db.quick_presets.update(preset.id, { layout: newLayout, updatedAt: Date.now() });
  };

  if (!isOpen) return null;

  const handleUnlockSystem = () => { if (passwordInput === '7vQ!mZ3#Lx9@N2$wR8^pT1&kD6*Hc4?yJ0=G' || !deepLogic.passwordEnabled) setIsSystemUnlocked(true); else alert("Access Denied."); };
  const handleFetchRepos = async () => {
      setIsFetchingRepos(true); try { const repoList = await fetchRepositories(settings.githubToken); setRepos(repoList); if (repoList.length === 0) setManualRepoInput(true); } catch (e) { console.error(e); setRepos([]); setManualRepoInput(true); } finally { setIsFetchingRepos(false); }
  };
  const handleBackupNow = async () => {
      setBackupStatus('uploading'); setBackupErrorLog(null);
      try {
          const storedStateStr = localStorage.getItem('project_cerberus_state_v5'); if (!storedStateStr) throw new Error("No state to backup"); const fullState: ChatState = JSON.parse(storedStateStr);
          let repoToUse = settings.githubRepo; if (!repoToUse.includes('/') && settings.githubOwner) repoToUse = `${settings.githubOwner}/${settings.githubRepo}`;
          await performBackup(settings.githubToken, repoToUse, fullState); setBackupStatus('success');
      } catch (e: any) { console.error(e); setBackupErrorLog(e.message + (e.stack ? `\n${e.stack}` : '')); setBackupStatus('error'); } finally { setTimeout(() => { if (backupStatus !== 'error') setBackupStatus('idle'); }, 3000); }
  };
  const confirmRestore = async () => {
      if (restoreInput !== 'Override' || !onRestore) return; setShowRestoreConfirm(false); setBackupStatus('restoring'); setBackupErrorLog(null);
      try {
          let repoToUse = settings.githubRepo; if (!repoToUse.includes('/') && settings.githubOwner) repoToUse = `${settings.githubOwner}/${settings.githubRepo}`;
          const newState = await restoreBackup(settings.githubToken, repoToUse); onRestore(newState); setBackupStatus('success'); alert("System State Overwritten.");
      } catch (e: any) { console.error(e); setBackupErrorLog(e.message + (e.stack ? `\n${e.stack}` : '')); setBackupStatus('error'); } finally { setTimeout(() => { if (backupStatus !== 'error') setBackupStatus('idle'); }, 3000); }
  };
  const handleSave = async () => {
      if (!isDirty) return;
      let owner = settings.githubOwner; let repo = settings.githubRepo; if (settings.githubRepo.includes('/')) [owner, repo] = settings.githubRepo.split('/');
      onSave({ ...settings, githubOwner: owner, githubRepo: repo }, character, rooms, scriptoriumConfig, deepLogic);
      if (isSystemUnlocked && settings.firebaseConfig?.apiKey) { if (runtime) await saveSettings('runtime', runtime); if (schedule) await saveSettings('schedule', schedule); if (memoryPolicy) await saveSettings('memoryPolicy', memoryPolicy); if (tools) await saveSettings('tools', tools); }
      setSaveStatus('success'); setBaseState({ settings, character, rooms, scriptoriumConfig, deepLogic }); setHistory([]); setFuture([]); setTimeout(() => setSaveStatus('idle'), 2000);
  };
  const handleAddRoom = () => updateRooms([...rooms, { id: uuidv4(), name: 'New Location', description: 'Description...', backgroundImage: '' }]);
  const handleDeleteRoom = (id: string) => rooms.length > 1 && updateRooms(rooms.filter(r => r.id !== id));
  const handleUpdateRoom = (id: string, field: keyof Room, value: string) => updateRooms(rooms.map(r => r.id === id ? { ...r, [field]: value } : r));
  const updateFirebaseConfig = (key: keyof FirebaseConfig, value: string) => { const current = settings.firebaseConfig || {} as FirebaseConfig; updateSettings({ ...settings, firebaseConfig: { ...current, [key]: value } }); };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-hidden">
      
      {isKeyManagerOpen && (
          <KeyManager 
            mode="settings" 
            existingKeys={settings}
            onKeysReady={(newKeys) => {
                updateSettings({ ...settings, ...newKeys });
                setIsKeyManagerOpen(false);
            }} 
            onClose={() => setIsKeyManagerOpen(false)}
          />
      )}

      <div className="bg-cerberus-900 border border-cerberus-700 w-full max-w-2xl rounded-lg shadow-2xl flex flex-col max-h-[85dvh] h-full overflow-hidden">
        
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between p-4 border-b border-cerberus-800 bg-cerberus-900 z-10 relative">
          <h2 className="text-xl font-serif text-cerberus-accent truncate mr-2">Configuration</h2>
          <div className="flex items-center gap-4 shrink-0">
               <div className="flex items-center gap-2 bg-cerberus-900/50 rounded-full px-2 py-1 border border-cerberus-800">
                   <button onClick={handleUndo} disabled={history.length === 0} className={`p-1 rounded-full transition-all ${history.length > 0 ? 'text-cerberus-accent hover:bg-cerberus-800' : 'text-gray-700 cursor-not-allowed'}`} title="Undo"><RotateCcw size={16} /></button>
                   <div className="w-px h-3 bg-cerberus-800"></div>
                   <button onClick={handleRedo} disabled={future.length === 0} className={`p-1 rounded-full transition-all ${future.length > 0 ? 'text-cerberus-accent hover:bg-cerberus-800' : 'text-gray-700 cursor-not-allowed'}`} title="Redo"><RotateCw size={16} /></button>
               </div>
               <div className="h-6 w-px bg-cerberus-700 hidden sm:block"></div>
               <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors bg-cerberus-800/20 p-1.5 rounded-full hover:bg-cerberus-800"><X size={20} /></button>
          </div>
        </div>

        {/* Tabs */}
        <div className="shrink-0 flex border-b border-cerberus-800 overflow-x-auto bg-cerberus-900 z-10">
          {(['api', 'character', 'appearance', 'locations', 'scriptorium', 'quickpanel', 'profiles', 'backups', 'deeplogic'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={`flex-1 py-3 px-4 text-xs font-medium uppercase tracking-wider transition-colors whitespace-nowrap ${activeTab === tab ? 'bg-cerberus-800 text-cerberus-accent' : 'text-gray-500 hover:bg-cerberus-800/50'}`}>
              {tab === 'deeplogic' ? 'Deep Logic' : (tab === 'profiles' ? 'Profiles' : (tab === 'quickpanel' ? 'Quick Panel' : tab))}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-cerberus-900/50" onScroll={() => setActiveTooltip(null)}>
          
          {/* API TAB */}
          {activeTab === 'api' && (
            <div className="space-y-4">
                {/* 1. Credentials */}
                <CollapsibleSection title="API Credentials & Provider" isOpen={openSections.credentials} onToggle={() => toggleSection('credentials')} icon={<Key size={16}/>}>
                  <div className="space-y-4">
                      <div className="bg-black/30 p-4 rounded border border-cerberus-700 flex flex-col gap-3">
                          <div className="flex items-center gap-2 text-cerberus-accent">
                              <Shield size={20} />
                              <span className="font-bold uppercase tracking-widest text-xs">Secure Key Storage</span>
                          </div>
                          <p className="text-[10px] text-gray-400">Keys are kept in memory (Session) or encrypted locally. Never stored on servers.</p>
                          <button 
                            onClick={() => setIsKeyManagerOpen(true)}
                            className="w-full py-3 bg-cerberus-800 hover:bg-cerberus-700 border border-cerberus-600 text-white rounded font-bold uppercase text-xs transition-colors flex items-center justify-center gap-2"
                          >
                              <Key size={14}/> Manage Keys & Provider
                          </button>
                          <div className="text-[9px] text-gray-500 font-mono text-center">
                              Active: {settings.activeProvider.toUpperCase()} 
                              {settings.activeProvider === 'gemini' && settings.apiKeyGemini ? ' (Loaded)' : 
                               settings.activeProvider === 'grok' && settings.apiKeyGrok ? ' (Loaded)' : ' (Not Configured)'}
                          </div>
                      </div>

                      {/* Model Select */}
                      {settings.activeProvider === 'gemini' ? (
                          <div>
                              <label className="block text-[10px] font-mono text-cerberus-accent uppercase tracking-wider mb-1">GEMINI MODEL</label>
                              <select value={settings.modelGemini} onChange={e => updateSettings({...settings, modelGemini: e.target.value})} className="w-full bg-black/50 border border-cerberus-700 rounded p-2 text-xs text-white">
                                  <option value="gemini-3-pro-preview">Gemini 3 Pro Preview</option>
                                  <option value="gemini-3-flash-preview">Gemini 3 Flash Preview</option>
                                  <option value="gemini-2.5-flash-latest">Gemini 2.5 Flash</option>
                              </select>
                          </div>
                      ) : (
                          <div>
                              <label className="block text-[10px] font-mono text-cerberus-accent uppercase tracking-wider mb-1">GROK MODEL</label>
                              <select value={settings.modelGrok} onChange={e => updateSettings({...settings, modelGrok: e.target.value})} className="w-full bg-black/50 border border-cerberus-700 rounded p-2 text-xs text-white">
                                  <option value="grok-beta">Grok Beta</option>
                                  <option value="grok-vision-beta">Grok Vision Beta</option>
                              </select>
                          </div>
                      )}
                  </div>
              </CollapsibleSection>

              {/* ... (Existing Response Config Logic) ... */}
              <CollapsibleSection 
                  title="Response Tuning" 
                  isOpen={openSections.inference} 
                  onToggle={() => toggleSection('inference')} 
                  icon={<Sliders size={16}/>}
                  isLocked={lockedSections['inference']}
                  onLockToggle={(e) => { e.stopPropagation(); toggleLock('inference'); }}
              >
                  <div className="space-y-6 pt-2">
                      <div>
                          <label className="block text-[10px] font-mono text-gray-400 uppercase tracking-wider mb-2">QUICK PRESETS</label>
                          <div className="flex gap-2">
                              <button onClick={() => applyPreset('strict')} className="flex-1 py-2 text-[10px] uppercase font-bold rounded border border-gray-700 bg-black/30 hover:bg-cerberus-800/50 hover:border-cerberus-500 transition-all text-gray-300">Strict / Agent</button>
                              <button onClick={() => applyPreset('balanced')} className="flex-1 py-2 text-[10px] uppercase font-bold rounded border border-gray-700 bg-black/30 hover:bg-cerberus-800/50 hover:border-cerberus-500 transition-all text-gray-300">Balanced</button>
                              <button onClick={() => applyPreset('wild')} className="flex-1 py-2 text-[10px] uppercase font-bold rounded border border-gray-700 bg-black/30 hover:bg-cerberus-800/50 hover:border-cerberus-500 transition-all text-gray-300">Wild / RP</button>
                          </div>
                      </div>
                      <div className="h-px bg-cerberus-800/50 my-4"></div>
                      <NumericSetting label="CREATIVITY (Temperature)" icon={<Sparkles size={14} />} helperText="Higher = Creative/Chaos. Lower = Focused/Logical." value={settings.temperature} min={0} max={2.0} step={0.05} onChange={v => updateSettings({...settings, temperature: v})} disabled={!capabilities.temperature}/>
                      <NumericSetting label="VARIETY (Top-P)" icon={<Layers size={14} />} helperText="Vocabulary breadth. Lower is safer, Higher is diverse." value={settings.topP} min={0.1} max={1.0} step={0.05} onChange={v => updateSettings({...settings, topP: v})} disabled={!capabilities.topP}/>
                      <NumericSetting label="MAX LENGTH (Tokens)" icon={<Maximize size={14} />} helperText="Hard cap on response size." value={settings.maxOutputTokens || 2048} min={128} max={8192} step={128} onChange={handleMaxTokensChange} isTokenMode disabled={!capabilities.maxOutputTokens}/>
                      <NumericSetting label="REPETITION CONTROL (Freq)" icon={<RotateCw size={14} />} helperText="Punishes repeating exact phrases." value={settings.frequencyPenalty} min={0} max={2.0} step={0.1} onChange={v => updateSettings({...settings, frequencyPenalty: v})} disabled={!capabilities.frequencyPenalty}/>
                      <NumericSetting label="NEW TOPICS (Presence)" icon={<Activity size={14} />} helperText="Encourages moving to new subjects." value={settings.presencePenalty} min={0} max={2.0} step={0.1} onChange={v => updateSettings({...settings, presencePenalty: v})} disabled={!capabilities.presencePenalty}/>
                      <div className="pt-2">
                          <button onClick={() => setShowAdvancedInference(!showAdvancedInference)} className="text-[10px] text-gray-500 hover:text-cerberus-accent flex items-center gap-1 uppercase tracking-wider">
                              {showAdvancedInference ? <ChevronDown size={12}/> : <ChevronRight size={12}/>} Advanced Controls
                          </button>
                          {showAdvancedInference && (
                              <div className="mt-4 space-y-4 pl-2 border-l border-cerberus-800 animate-fadeIn">
                                  <NumericSetting label="TOP-K (Sampling)" icon={<Code size={14} />} helperText="Limits choices to top K words. 0 = Off." value={settings.topK || 0} min={0} max={100} step={1} onChange={v => updateSettings({...settings, topK: v})} disabled={!capabilities.topK}/>
                                  <div><label className="block text-[10px] font-mono text-gray-400 uppercase tracking-wider mb-1 flex items-center gap-2"><X size={14} className="text-cerberus-600"/> STOP PHRASES</label><input type="text" value={settings.stopSequences} onChange={e => updateSettings({...settings, stopSequences: e.target.value})} className="w-full bg-black/50 border border-cerberus-700 rounded p-2 text-xs text-white focus:border-cerberus-500 outline-none" placeholder="Comma separated (e.g. 'User:', 'End')" disabled={!capabilities.stopSequences}/></div>
                                  <div className="flex items-center justify-between"><label className="text-[10px] font-mono text-gray-400 uppercase tracking-wider flex items-center gap-2"><ShieldAlert size={14} className="text-cerberus-600"/> SAFETY LEVEL</label><select value={settings.safetyLevel} onChange={e => updateSettings({...settings, safetyLevel: e.target.value as any})} className="bg-black/50 border border-cerberus-700 rounded p-1 text-[10px] text-white uppercase outline-none"><option value="strict">Strict</option><option value="standard">Standard</option><option value="off">OFF (Unfiltered)</option></select></div>
                                  {settings.safetyLevel === 'off' && (<p className="text-[9px] text-red-400/80 italic mt-1 pl-1">Warning: Disables all model safety filters. Provider hardcoded blocks (CSAM, etc.) still apply.</p>)}
                              </div>
                          )}
                      </div>
                  </div>
              </CollapsibleSection>

              {/* ... (Existing Roleplay Config Logic) ... */}
              <CollapsibleSection 
                  title="Roleplay & Style" 
                  isOpen={openSections.roleplay} 
                  onToggle={() => toggleSection('roleplay')} 
                  icon={<MessageSquare size={16}/>}
                  isLocked={lockedSections['roleplay']}
                  onLockToggle={(e) => { e.stopPropagation(); toggleLock('roleplay'); }}
              >
                  <div className="space-y-6 pt-2">
                      <NumericSetting label="RP INTENSITY" icon={<Zap size={14} />} helperText="How strongly the entity stays in character." value={settings.roleplayIntensity} min={0} max={100} step={5} onChange={v => updateSettings({...settings, roleplayIntensity: v})} suffix="%"/>
                      <div className="grid grid-cols-2 gap-4">
                          <div><label className="block text-[10px] font-mono text-gray-400 uppercase tracking-wider mb-1 flex items-center gap-2"><Edit3 size={14} className="text-cerberus-600"/> WRITING STYLE</label><select value={settings.writingStyle} onChange={e => updateSettings({...settings, writingStyle: e.target.value as any})} className="w-full bg-black/50 border border-cerberus-700 rounded p-2 text-xs text-white uppercase outline-none"><option value="plain">Plain</option><option value="balanced">Balanced</option><option value="ornate">Ornate</option></select></div>
                          <div><label className="block text-[10px] font-mono text-gray-400 uppercase tracking-wider mb-1 flex items-center gap-2"><Layout size={14} className="text-cerberus-600"/> FORMATTING</label><select value={settings.formattingStyle} onChange={e => updateSettings({...settings, formattingStyle: e.target.value as any})} className="w-full bg-black/50 border border-cerberus-700 rounded p-2 text-xs text-white uppercase outline-none"><option value="paragraphs">Paragraphs</option><option value="bubbles">Chat Bubbles</option><option value="screenplay">Screenplay</option><option value="markdown">Markdown</option></select></div>
                      </div>
                      <NumericSetting label="THINKING BUDGET (%)" icon={<BrainCircuit size={14} />} helperText="Percentage of Max Tokens reserved for reasoning (Gemini Only)." value={settings.thinkingBudgetPercentage || 0} min={0} max={100} step={5} onChange={v => updateSettings({...settings, thinkingBudgetPercentage: v})} suffix="%"/>
                  </div>
              </CollapsibleSection>

              {/* ... (Existing Voice Config Logic) ... */}
              <CollapsibleSection 
                  title="Voice Input" 
                  isOpen={openSections.voice} 
                  onToggle={() => toggleSection('voice')} 
                  icon={<Mic size={16}/>}
              >
                  <div className="space-y-4">
                      <div><label className="block text-[10px] font-mono text-cerberus-accent uppercase tracking-wider mb-1">OPENAI API KEY (WHISPER)</label><input type="password" value={settings.apiKeyOpenAI || ''} onChange={(e) => updateSettings({...settings, apiKeyOpenAI: e.target.value})} className="w-full bg-black/50 border border-cerberus-700 rounded p-2 text-white focus:border-cerberus-500 focus:outline-none font-mono text-sm placeholder-gray-700" placeholder="Required for high-quality VTT" /></div>
                      <div><label className="block text-[10px] font-mono text-cerberus-accent uppercase tracking-wider mb-1">TRANSCRIPTION MODEL</label><select value={settings.transcriptionModel} onChange={e => updateSettings({...settings, transcriptionModel: e.target.value as any})} className="w-full bg-black/50 border border-cerberus-700 rounded p-2 text-sm text-white"><option value="gpt-4o-mini-transcribe">gpt-4o-mini-transcribe ($0.003/min)</option><option value="gpt-4o-transcribe">gpt-4o-transcribe ($0.006/min)</option></select></div>
                      <div className="flex items-center justify-between"><label className="text-[10px] font-mono text-gray-400 uppercase tracking-wider">AUTO-SEND AFTER RECORDING</label><div onClick={() => updateSettings({...settings, vttAutoSend: !settings.vttAutoSend})} className={`w-10 h-5 rounded-full cursor-pointer transition-colors p-1 ${settings.vttAutoSend ? 'bg-cerberus-accent' : 'bg-gray-700'}`}><div className={`w-3 h-3 bg-black rounded-full shadow-md transform transition-transform ${settings.vttAutoSend ? 'translate-x-5' : 'translate-x-0'}`} /></div></div>
                  </div>
              </CollapsibleSection>
            </div>
          )}

          {/* ... (Rest of Tabs unchanged) ... */}
          {activeTab === 'quickpanel' && (
              <div className="space-y-4">
                  <div className="p-4 bg-cerberus-800/30 border border-cerberus-700 rounded">
                      <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-2"><Smartphone size={16}/> Home Screen Widget</h3>
                      <p className="text-[10px] text-gray-400 mb-4">
                          Customize the layout of the Quick Capture panel. This is what you see when you tap the app shortcut.
                      </p>
                      {quickPresets.map(preset => (
                          <div key={preset.id} className="space-y-4">
                              <div className="flex justify-between items-center bg-black/30 p-2 rounded">
                                  <span className="text-xs font-mono text-cerberus-accent uppercase">{preset.name}</span>
                                  <span className="text-[9px] text-gray-600 uppercase">Default</span>
                              </div>
                              <div className="space-y-2">
                                  <label className="block text-[9px] text-gray-500 uppercase font-bold">Enabled Elements</label>
                                  <div className="grid grid-cols-2 gap-2">
                                      {['mic', 'today_list', 'next_event'].map(type => {
                                          const isActive = preset.layout.some(el => el.type === type);
                                          return (
                                              <button 
                                                  key={type}
                                                  onClick={() => toggleQuickElement(preset, type)}
                                                  className={`p-3 border rounded text-xs uppercase font-bold transition-all ${isActive ? 'bg-cerberus-800 border-cerberus-500 text-white' : 'bg-black/20 border-cerberus-900 text-gray-600'}`}
                                              >
                                                  {type.replace('_', ' ')}
                                              </button>
                                          );
                                      })}
                                  </div>
                              </div>
                          </div>
                      ))}
                  </div>
                  <div className="p-4 bg-black/30 border border-cerberus-800 rounded">
                      <h4 className="text-xs font-bold text-gray-300 uppercase mb-2">How to Add to Home Screen</h4>
                      <ol className="list-decimal list-inside text-[10px] text-gray-500 space-y-1">
                          <li>Long-press the App Icon on your home screen.</li>
                          <li>Tap "Quick Capture" in the popup menu.</li>
                          <li>Drag it to your home screen to create a dedicated shortcut.</li>
                      </ol>
                  </div>
              </div>
          )}

          {/* ... (Character, Appearance, Locations, Scriptorium, Profiles, DeepLogic tabs - assume unchanged) ... */}
          {/* OMITTED FOR BREVITY, no changes in logic for other tabs, purely UI text/inputs for keys moved */}
          {activeTab === 'character' && (
             <div className="space-y-6">
                 <div><label className="block text-[10px] font-mono text-cerberus-accent uppercase tracking-wider mb-1">CHARACTER NAME</label><input type="text" value={character.name} onChange={(e) => updateCharacter({...character, name: e.target.value})} className="w-full bg-black/50 border border-cerberus-700 rounded p-2 text-white focus:border-cerberus-500" /></div>
                 <div><label className="block text-[10px] font-mono text-cerberus-accent uppercase tracking-wider mb-1">USER NAME</label><input type="text" value={settings.userName} onChange={(e) => updateSettings({...settings, userName: e.target.value})} className="w-full bg-black/50 border border-cerberus-700 rounded p-2 text-white focus:border-cerberus-500" /></div>
                 <div><label className="block text-[10px] font-mono text-cerberus-accent uppercase tracking-wider mb-1">USER DESCRIPTION</label><textarea value={settings.userDescription || ''} onChange={(e) => updateSettings({...settings, userDescription: e.target.value})} className="w-full h-24 bg-black/50 border border-cerberus-700 rounded p-2 text-gray-300 text-xs font-mono leading-relaxed focus:border-cerberus-500 custom-scrollbar" /></div>
                 <div><div className="flex justify-between items-center mb-1"><label className="block text-[10px] font-mono text-cerberus-accent uppercase tracking-wider">SYSTEM PROMPT</label><span className="text-[9px] text-gray-500 uppercase">Core Identity</span></div><textarea value={character.systemPrompt} onChange={(e) => updateCharacter({...character, systemPrompt: e.target.value})} className="w-full h-64 bg-black/50 border border-cerberus-700 rounded p-2 text-gray-300 text-xs font-mono leading-relaxed focus:border-cerberus-500 custom-scrollbar" /></div>
                 <div className="border-t border-cerberus-800 pt-4"><div className="flex justify-between items-center mb-2"><label className="block text-[10px] font-mono text-cerberus-accent uppercase tracking-wider">SPATIAL LOGIC</label><div className="flex bg-black/50 rounded p-0.5 border border-cerberus-800"><button onClick={() => switchLogicMode('basic')} className={`px-2 py-1 text-[9px] uppercase font-bold rounded-sm transition-colors ${logicMode === 'basic' ? 'bg-cerberus-800 text-white' : 'text-gray-500 hover:text-gray-300'}`}>Basic</button><button onClick={() => switchLogicMode('advanced')} className={`px-2 py-1 text-[9px] uppercase font-bold rounded-sm transition-colors ${logicMode === 'advanced' ? 'bg-cerberus-800 text-white' : 'text-gray-500 hover:text-gray-300'}`}>Advanced</button></div></div><textarea value={character.mappingLogic} onChange={(e) => handleLogicChange(e.target.value)} className="w-full h-48 bg-black/50 border border-cerberus-700 rounded p-2 text-gray-400 text-[10px] font-mono leading-relaxed focus:border-cerberus-500 custom-scrollbar" /><p className="text-[9px] text-gray-600 mt-1">Controls how the entity understands physical space, distance, and anatomy.</p></div>
             </div>
          )}
          {activeTab === 'appearance' && (
              <div className="space-y-8">
                  <div className="p-4 bg-cerberus-800/20 border border-cerberus-700 rounded flex items-center justify-between"><div><h4 className="text-sm font-bold text-white flex items-center gap-2"><Zap size={14} className="text-yellow-500"/> Fast Boot</h4><p className="text-[10px] text-gray-500">Skip the cinematic video intro on startup.</p></div><div onClick={() => updateSettings({...settings, fastBoot: !settings.fastBoot})} className={`w-10 h-5 rounded-full cursor-pointer transition-colors p-1 ${settings.fastBoot ? 'bg-yellow-600' : 'bg-gray-700'}`}><div className={`w-3 h-3 bg-white rounded-full shadow-md transform transition-transform ${settings.fastBoot ? 'translate-x-5' : 'translate-x-0'}`} /></div></div>
                  <div><h3 className="text-xs font-mono text-cerberus-accent uppercase tracking-widest mb-4 border-b border-cerberus-800 pb-1">ENVIRONMENT</h3><NumericSetting label="BACKGROUND BRIGHTNESS" value={settings.bgBrightness} min={0} max={100} step={5} onChange={v => updateSettings({...settings, bgBrightness: v})} suffix="%" /></div>
                  <div><h3 className="text-xs font-mono text-cerberus-accent uppercase tracking-widest mb-4 border-b border-cerberus-800 pb-1">PORTRAIT</h3><div className="grid grid-cols-2 gap-4 mb-4"><div><label className="block text-[9px] text-gray-500 mb-1">ASPECT RATIO</label><select value={settings.portraitAspectRatio} onChange={e => updateSettings({...settings, portraitAspectRatio: e.target.value as any})} className="w-full bg-black/50 border border-cerberus-700 rounded p-2 text-xs text-white"><option value="4/5">Standard (4:5)</option><option value="9/16">Tall (9:16)</option><option value="1/1">Square (1:1)</option></select></div></div><NumericSetting label="SCALE" value={settings.portraitScale} min={0.5} max={3.0} step={0.1} onChange={v => updateSettings({...settings, portraitScale: v})} /></div>
                  <div><h3 className="text-xs font-mono text-cerberus-accent uppercase tracking-widest mb-4 border-b border-cerberus-800 pb-1">ENTITY TYPOGRAPHY</h3><div className="space-y-3"><input type="text" placeholder="Google Fonts URL" value={settings.aiTextFontUrl} onChange={e => updateSettings({...settings, aiTextFontUrl: e.target.value})} className="w-full bg-black/50 border border-cerberus-700 rounded p-2 text-xs text-gray-300" /><div className="flex gap-4"><div className="flex-1"><label className="block text-[9px] text-gray-500 mb-1">COLOR</label><input type="color" value={settings.aiTextColor} onChange={e => updateSettings({...settings, aiTextColor: e.target.value})} className="w-full h-8 bg-transparent border border-cerberus-700 rounded cursor-pointer" /></div><div className="flex-1"><label className="block text-[9px] text-gray-500 mb-1">EFFECT</label><select value={settings.aiTextStyle} onChange={e => updateSettings({...settings, aiTextStyle: e.target.value as any})} className="w-full h-8 bg-black/50 border border-cerberus-700 rounded text-xs text-gray-300"><option value="none">None</option><option value="shadow">Shadow</option><option value="outline">Outline</option><option value="neon">Neon</option></select></div></div><NumericSetting label="SIZE" value={settings.aiTextSize} min={10} max={32} step={1} onChange={v => updateSettings({...settings, aiTextSize: v})} suffix="px" /></div></div>
                  <div><h3 className="text-xs font-mono text-cerberus-accent uppercase tracking-widest mb-4 border-b border-cerberus-800 pb-1">USER TYPOGRAPHY</h3><div className="space-y-3"><input type="text" placeholder="Google Fonts URL" value={settings.userTextFontUrl} onChange={e => updateSettings({...settings, userTextFontUrl: e.target.value})} className="w-full bg-black/50 border border-cerberus-700 rounded p-2 text-xs text-gray-300" /><div className="flex gap-4"><div className="flex-1"><label className="block text-[9px] text-gray-500 mb-1">COLOR</label><input type="color" value={settings.userTextColor} onChange={e => updateSettings({...settings, userTextColor: e.target.value})} className="w-full h-8 bg-transparent border border-cerberus-700 rounded cursor-pointer" /></div></div><NumericSetting label="SIZE" value={settings.userTextSize} min={10} max={32} step={1} onChange={v => updateSettings({...settings, userTextSize: v})} suffix="px" /></div></div>
              </div>
          )}
          {activeTab === 'locations' && (<div className="space-y-4">{rooms.map(room => (<div key={room.id} className="p-4 bg-cerberus-900 border border-cerberus-800 rounded group relative"><button onClick={() => handleDeleteRoom(room.id)} className="absolute top-2 right-2 text-gray-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={16}/></button><div className="space-y-2"><input type="text" value={room.name} onChange={e => handleUpdateRoom(room.id, 'name', e.target.value)} className="w-full bg-transparent border-b border-transparent focus:border-cerberus-accent text-sm font-bold text-white outline-none" placeholder="Location Name" /><input type="text" value={room.backgroundImage} onChange={e => handleUpdateRoom(room.id, 'backgroundImage', e.target.value)} className="w-full bg-black/30 text-[10px] text-gray-500 p-1 rounded font-mono outline-none focus:text-white" placeholder="Image URL..." /><textarea value={room.description} onChange={e => handleUpdateRoom(room.id, 'description', e.target.value)} className="w-full bg-transparent text-xs text-gray-400 outline-none resize-none h-16 custom-scrollbar focus:text-gray-200" placeholder="Sensory details..." /></div></div>))}<button onClick={handleAddRoom} className="w-full py-3 border border-dashed border-cerberus-700 text-cerberus-600 hover:text-cerberus-accent hover:border-cerberus-accent rounded uppercase text-xs font-bold transition-all flex items-center justify-center gap-2"><Plus size={16} /> Add Location</button></div>)}
          {activeTab === 'scriptorium' && (<div className="space-y-6"><div><label className="block text-[10px] font-mono text-cerberus-accent uppercase tracking-wider mb-2">BACKGROUND IMAGE</label><input type="text" value={scriptoriumConfig.backgroundImage} onChange={e => updateScriptorium({...scriptoriumConfig, backgroundImage: e.target.value})} className="w-full bg-black/50 border border-cerberus-700 rounded p-2 text-xs text-white" /></div><div><label className="block text-[10px] font-mono text-cerberus-accent uppercase tracking-wider mb-2">SECRETARY PERSONA</label><textarea value={scriptoriumConfig.systemPrompt} onChange={e => updateScriptorium({...scriptoriumConfig, systemPrompt: e.target.value})} className="w-full h-48 bg-black/50 border border-cerberus-700 rounded p-2 text-gray-300 text-xs font-mono leading-relaxed custom-scrollbar" /></div><div><label className="block text-[10px] font-mono text-cerberus-accent uppercase tracking-wider mb-2">ACTIVE TOOLS</label><div className="grid grid-cols-2 gap-2">{(['gmail', 'calendar', 'tasks', 'docs', 'keep'] as const).map(tool => (<button key={tool} onClick={() => updateScriptorium({...scriptoriumConfig, tools: { ...scriptoriumConfig.tools, [tool]: !scriptoriumConfig.tools[tool] }})} className={`p-3 rounded border text-xs uppercase font-bold transition-all ${scriptoriumConfig.tools[tool] ? 'bg-cerberus-800 border-cerberus-500 text-white' : 'bg-black/30 border-cerberus-900 text-gray-600'}`}>{tool}</button>))}</div></div></div>)}
          {activeTab === 'deeplogic' && (<div className="h-full flex flex-col">{!isSystemUnlocked ? (<div className="flex-1 flex flex-col items-center justify-center space-y-4"><Lock size={48} className="text-cerberus-700 mb-4" /><p className="text-xs text-red-500 font-mono tracking-widest uppercase">Restricted Access</p><input type="password" value={passwordInput} onChange={e => setPasswordInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleUnlockSystem()} className="bg-black border border-cerberus-800 p-2 text-center text-red-500 font-mono tracking-[0.5em] w-64 focus:outline-none focus:border-red-600 rounded" /><button onClick={handleUnlockSystem} className="px-6 py-2 bg-cerberus-900 border border-cerberus-700 text-gray-400 hover:text-white hover:border-white transition-colors text-xs uppercase">Authenticate</button></div>) : (<div className="space-y-6"><div className="p-4 bg-red-950/20 border border-red-900/50 rounded"><h3 className="text-red-500 font-mono text-xs mb-2 uppercase">Core Overrides</h3><div className="space-y-2"><div className="flex justify-between items-center"><span className="text-gray-400 text-xs">Kill Switch</span><div onClick={() => updateDeepLogic({...deepLogic, killSwitch: !deepLogic.killSwitch})} className={`w-10 h-5 rounded-full cursor-pointer p-1 transition-colors ${deepLogic.killSwitch ? 'bg-red-600' : 'bg-gray-700'}`}><div className={`w-3 h-3 bg-white rounded-full transition-transform ${deepLogic.killSwitch ? 'translate-x-5' : 'translate-x-0'}`} /></div></div><div className="flex justify-between items-center"><span className="text-gray-400 text-xs">Password Protection</span><div onClick={() => updateDeepLogic({...deepLogic, passwordEnabled: !deepLogic.passwordEnabled})} className={`w-10 h-5 rounded-full cursor-pointer p-1 transition-colors ${deepLogic.passwordEnabled ? 'bg-green-600' : 'bg-gray-700'}`}><div className={`w-3 h-3 bg-white rounded-full transition-transform ${deepLogic.passwordEnabled ? 'translate-x-5' : 'translate-x-0'}`} /></div></div></div></div><div className="p-4 bg-cerberus-900 border border-cerberus-800 rounded"><h3 className="text-cerberus-accent font-mono text-xs mb-4 uppercase">External Links</h3><div className="space-y-3"><input type="text" placeholder="NTFY Topic Name" value={deepLogic.secrets.ntfyTopic} onChange={e => updateDeepLogic({...deepLogic, secrets: {...deepLogic.secrets, ntfyTopic: e.target.value}})} className="w-full bg-black/50 border border-cerberus-700 rounded p-2 text-xs text-white" /><input type="text" placeholder="Google Sheet ID" value={deepLogic.secrets.sheetId} onChange={e => updateDeepLogic({...deepLogic, secrets: {...deepLogic.secrets, sheetId: e.target.value}})} className="w-full bg-black/50 border border-cerberus-700 rounded p-2 text-xs text-white" /></div></div><div className="p-4 bg-blue-950/20 border border-blue-900/30 rounded"><h3 className="text-blue-400 font-mono text-xs mb-4 uppercase">Firebase Configuration</h3><div className="space-y-2"><input type="text" placeholder="API Key" value={settings.firebaseConfig?.apiKey || ''} onChange={e => updateFirebaseConfig('apiKey', e.target.value)} className="w-full bg-black/50 border border-blue-900/50 rounded p-2 text-xs text-blue-100 font-mono" /><input type="text" placeholder="Project ID" value={settings.firebaseConfig?.projectId || ''} onChange={e => updateFirebaseConfig('projectId', e.target.value)} className="w-full bg-black/50 border border-blue-900/50 rounded p-2 text-xs text-blue-100 font-mono" /></div></div></div>)}</div>)}
          {activeTab === 'profiles' && (<div className="space-y-6">{profiles.map(slot => (<div key={slot.id} className="p-4 bg-cerberus-900 border border-cerberus-800 rounded group flex items-center justify-between"><div className="flex-1"><h3 className="text-sm font-serif font-bold text-white mb-1">{slot.name}</h3><p className="text-[10px] text-gray-500 font-mono">{slot.timestamp ? new Date(slot.timestamp).toLocaleString() : 'Empty Slot'}</p></div><div className="flex items-center gap-2">{showSaveAsConfirm === slot.id ? (<div className="flex items-center gap-2 animate-fadeIn"><input autoFocus placeholder="Type 'Save As Now'" className="bg-black border border-cerberus-accent text-cerberus-accent text-[10px] p-1 rounded w-24" value={saveAsInput} onChange={e => setSaveAsInput(e.target.value)} /><button onClick={() => handleProfileSaveAs(slot.id)} className="text-green-500 hover:text-green-400"><Check size={16}/></button><button onClick={() => { setShowSaveAsConfirm(null); setSaveAsInput(''); }} className="text-red-500 hover:text-red-400"><X size={16}/></button></div>) : (<><button onClick={() => handleProfileLoad(slot.id)} disabled={!slot.data} className="p-2 border border-cerberus-700 text-cerberus-accent rounded hover:bg-cerberus-800 disabled:opacity-30 disabled:cursor-not-allowed text-[10px] uppercase font-bold">Load</button><button onClick={() => setShowSaveAsConfirm(slot.id)} className="p-2 bg-cerberus-800 text-gray-300 rounded hover:bg-cerberus-700 text-[10px] uppercase font-bold">Save</button></>)}</div></div>))}</div>)}

           {/* BACKUPS TAB (With API Key Reveal) */}
           {activeTab === 'backups' && (
               <div className="space-y-6">
                   <div className="p-4 bg-black/30 border border-cerberus-800 rounded">
                       <h3 className="flex items-center gap-2 text-white font-serif mb-4"><FileText size={20} /> Local Export</h3>
                       <p className="text-[10px] text-gray-500 mb-4">Download a complete, formatted text record of all conversations.</p>
                       <button onClick={onExportTxt} className="w-full py-3 border border-cerberus-600 text-cerberus-accent hover:bg-cerberus-800/30 rounded font-bold uppercase text-xs transition-colors flex items-center justify-center gap-2">
                           <Download size={16} /> Export Chat Logs (.txt)
                       </button>
                   </div>
                   <div className="p-4 bg-black/30 border border-cerberus-800 rounded">
                       <h3 className="flex items-center gap-2 text-white font-serif mb-4"><Github size={20} /> GitHub Backup</h3>
                       <div className="space-y-4">
                           <div>
                               <label className="block text-[10px] font-mono text-cerberus-accent uppercase tracking-wider mb-1">PERSONAL ACCESS TOKEN</label>
                               <div className="flex gap-2">
                                   <input 
                                       type={showGithubToken ? "text" : "password"} 
                                       value={settings.githubToken} 
                                       onChange={(e) => updateSettings({...settings, githubToken: e.target.value})} 
                                       className="flex-1 bg-cerberus-900 border border-cerberus-700 rounded p-2 text-sm text-white focus:border-cerberus-500 font-mono" 
                                   />
                                   <button 
                                       onClick={() => setShowGithubToken(!showGithubToken)}
                                       className="px-3 border border-cerberus-700 rounded text-gray-400 hover:text-white"
                                       title="Show Token"
                                   >
                                       {showGithubToken ? <EyeOff size={16}/> : <Eye size={16}/>}
                                   </button>
                               </div>
                               <button onClick={handleFetchRepos} className="text-[10px] text-cerberus-accent mt-1 hover:underline">Refresh Repos</button>
                           </div>
                           <div>
                                <label className="block text-[10px] font-mono text-cerberus-accent uppercase tracking-wider mb-1 flex justify-between">
                                    <span>REPOSITORY</span>
                                    <button onClick={() => setManualRepoInput(!manualRepoInput)} className="text-[9px] text-gray-500 hover:text-cerberus-accent uppercase flex items-center gap-1"><Edit3 size={10} /> {manualRepoInput ? "Switch to Select" : "Manual Input"}</button>
                                </label>
                                {manualRepoInput ? (
                                    <input type="text" value={settings.githubRepo} onChange={(e) => updateSettings({...settings, githubRepo: e.target.value})} placeholder="Owner/RepoName" className="w-full bg-cerberus-900 border border-cerberus-700 rounded p-2 text-sm text-white focus:border-cerberus-500 font-mono" />
                                ) : (
                                    <select value={settings.githubRepo} onChange={(e) => updateSettings({...settings, githubRepo: e.target.value})} className="w-full bg-cerberus-900 border border-cerberus-700 rounded p-2 text-sm text-white focus:border-cerberus-500">
                                        <option value="">Select...</option>
                                        {settings.githubRepo && !repos.includes(settings.githubRepo) && (<option value={settings.githubRepo}>{settings.githubRepo}</option>)}
                                        {repos.map(r => (<option key={r} value={r}>{r}</option>))}
                                    </select>
                                )}
                           </div>
                           <div className="pt-4 border-t border-cerberus-800 space-y-4">
                                <button onClick={handleBackupNow} disabled={backupStatus === 'uploading' || !settings.githubRepo} className={`w-full py-3 rounded font-bold uppercase text-xs flex items-center justify-center gap-2 transition-all duration-500 disabled:opacity-50 disabled:cursor-not-allowed ${backupStatus === 'success' ? 'bg-green-800 text-white shadow-[0_0_15px_rgba(34,197,94,0.3)]' : 'bg-cerberus-600 text-white hover:bg-cerberus-500'}`}>
                                    {backupStatus === 'uploading' ? (<>Pushing... <Loader2 className="animate-spin" size={14} /></>) : backupStatus === 'success' ? (<>Backup Complete <Check size={16} className="text-white" /></>) : "Push Backup"}
                                </button>
                                <button onClick={() => setShowRestoreConfirm(true)} disabled={backupStatus === 'uploading' || !settings.githubRepo} className="w-full py-3 border border-red-800 text-red-500 rounded font-bold uppercase text-xs hover:bg-red-900/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">Restore Backup</button>
                           </div>
                           {showRestoreConfirm && (
                               <div className="p-4 bg-red-900/20 border border-red-800 rounded mt-4 w-full">
                                   <p className="text-red-400 text-xs mb-2">Type "Override" to confirm restore.</p>
                                   <div className="flex gap-2 items-center w-full">
                                       <input 
                                           value={restoreInput} 
                                           onChange={e => setRestoreInput(e.target.value)} 
                                           className="bg-black border border-red-800 text-red-500 p-1 flex-1 min-w-0 text-xs" 
                                       />
                                       <button onClick={confirmRestore} className="px-3 py-1 bg-red-800 text-white text-xs whitespace-nowrap shrink-0">
                                           OK
                                       </button>
                                   </div>
                               </div>
                           )}
                           {backupErrorLog && (<div className="mt-4 p-3 bg-red-950/30 border border-red-500/50 rounded relative group animate-fadeIn"><h4 className="text-red-400 text-[10px] font-bold uppercase mb-2 flex items-center gap-2"><AlertCircle size={12}/> Error Report</h4><pre className="text-[10px] font-mono text-red-300 whitespace-pre-wrap overflow-auto max-h-32 p-2 bg-black/50 rounded border border-red-900/50 scrollbar-thin">{backupErrorLog}</pre><button onClick={() => navigator.clipboard.writeText(backupErrorLog)} className="absolute top-2 right-2 p-1.5 bg-red-900 hover:bg-red-800 text-white text-[9px] rounded flex items-center gap-1 transition-colors" title="Copy to Clipboard"><Copy size={10} /> COPY</button></div>)}
                       </div>
                   </div>
               </div>
           )}

        </div>

        {/* Footer */}
        <div className="shrink-0 p-4 border-t border-cerberus-800 bg-cerberus-900 z-10 flex justify-end">
          <button 
            onClick={handleSave}
            disabled={!isDirty}
            className={`flex items-center gap-2 px-6 py-2 rounded shadow-lg transition-all font-serif duration-300 ${saveStatus === 'success' ? 'bg-green-800 text-white' : (isDirty ? 'bg-cerberus-600 hover:bg-cerberus-500 text-white' : 'bg-gray-800 text-gray-500 cursor-not-allowed')}`}
          >
             {saveStatus === 'success' ? <CheckCircle size={18} /> : <Save size={18} />}
             <span>{activeTab === 'deeplogic' ? 'Deploy Configuration' : 'Save Settings'}</span>
          </button>
        </div>

      </div>
    </div>
  );
};

export default SettingsModal;