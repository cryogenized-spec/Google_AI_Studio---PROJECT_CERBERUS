import React, { useState, useEffect } from 'react';
import { X, CheckCircle, AlertCircle, Save, Plus, Trash2, Github, Sliders, Lock, Unlock, Database, ScrollText, Activity, Power, Terminal, Clock, Maximize, Info, User, HardDrive, Download, Upload, Sparkles, Copy } from 'lucide-react';
import { AppSettings, CharacterProfile, Room, ChatState, FirebaseConfig, ScriptoriumConfig, DeepLogicConfig, ScheduleSettings, RuntimeSettings, MemoryPolicy, ToolSettings, WakeLog, ProfileSlot } from '../types';
import { testGeminiConnection } from '../services/geminiService';
import { testGrokConnection } from '../services/grokService';
import { fetchRepositories, performBackup, restoreBackup } from '../services/githubService';
import { fetchSettings, saveSettings, fetchWakeLogs } from '../services/firebaseService';
import { v4 as uuidv4 } from 'uuid';

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
  rooms?: Room[];
}

// Helper for deep comparison
const isDeepEqual = (obj1: any, obj2: any) => JSON.stringify(obj1) === JSON.stringify(obj2);

const PROFILE_STORAGE_KEY = 'project_cerberus_profiles_v1';

const SettingsModal: React.FC<SettingsModalProps> = ({ 
    isOpen, 
    onClose, 
    settings: initialSettings, 
    character: initialCharacter,
    scriptoriumConfig: initialScriptoriumConfig,
    deepLogicConfig: initialDeepLogicConfig,
    initialTab,
    onSave,
    onRestore,
    rooms: initialRooms = []
}) => {
  // State
  const [settings, setSettings] = useState<AppSettings>(initialSettings);
  const [character, setCharacter] = useState<CharacterProfile>(initialCharacter);
  const [rooms, setRooms] = useState<Room[]>(initialRooms);
  const [scriptoriumConfig, setScriptoriumConfig] = useState<ScriptoriumConfig>(initialScriptoriumConfig || {
      backgroundImage: '',
      systemPrompt: '',
      tools: { gmail: true, calendar: true, tasks: true, docs: true, keep: true }
  });
  const [deepLogic, setDeepLogic] = useState<DeepLogicConfig>(initialDeepLogicConfig);

  // Undo/Redo Stacks
  const [history, setHistory] = useState<string[]>([]); 
  const [future, setFuture] = useState<string[]>([]);

  // Profiles State
  const [profiles, setProfiles] = useState<ProfileSlot[]>([]);
  const [saveAsInput, setSaveAsInput] = useState('');
  const [showSaveAsConfirm, setShowSaveAsConfirm] = useState<number | null>(null);

  // Reference for "Clean State" to determine Dirty status
  const [baseState, setBaseState] = useState({
      settings: initialSettings,
      character: initialCharacter,
      rooms: initialRooms,
      scriptoriumConfig: initialScriptoriumConfig,
      deepLogic: initialDeepLogicConfig
  });

  // Ops Console / Firestore State
  const [runtime, setRuntime] = useState<RuntimeSettings | null>(null);
  const [schedule, setSchedule] = useState<ScheduleSettings | null>(null);
  const [memoryPolicy, setMemoryPolicy] = useState<MemoryPolicy | null>(null);
  const [tools, setTools] = useState<ToolSettings | null>(null);
  const [logs, setLogs] = useState<WakeLog[]>([]);
  const [isLoadingOps, setIsLoadingOps] = useState(false);

  // UI State
  const [activeTab, setActiveTab] = useState<'api' | 'character' | 'appearance' | 'locations' | 'scriptorium' | 'profiles' | 'backups' | 'deeplogic'>('api');
  const [deepLogicSubTab, setDeepLogicSubTab] = useState<'core' | 'memory' | 'automation'>('core');
  const [isSystemUnlocked, setIsSystemUnlocked] = useState(!initialDeepLogicConfig.passwordEnabled);
  const [passwordInput, setPasswordInput] = useState('');
  const [isFineTuningLocked, setIsFineTuningLocked] = useState(true); // Re-enabled lock for Generation Parameters
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'failure'>('idle');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success'>('idle');
  const [repos, setRepos] = useState<string[]>([]);
  const [isFetchingRepos, setIsFetchingRepos] = useState(false);
  const [backupStatus, setBackupStatus] = useState<'idle' | 'uploading' | 'restoring' | 'success' | 'error'>('idle');
  const [backupErrorLog, setBackupErrorLog] = useState<string | null>(null);
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
  const [restoreInput, setRestoreInput] = useState('');

  // Initial Load
  useEffect(() => {
      setSettings(initialSettings);
      setCharacter(initialCharacter);
      setRooms(initialRooms);
      setDeepLogic(initialDeepLogicConfig);
      if(initialScriptoriumConfig) setScriptoriumConfig(initialScriptoriumConfig);
      
      setBaseState({
          settings: initialSettings,
          character: initialCharacter,
          rooms: initialRooms,
          scriptoriumConfig: initialScriptoriumConfig || { backgroundImage: '', systemPrompt: '', tools: { gmail: true, calendar: true, tasks: true, docs: true, keep: true }},
          deepLogic: initialDeepLogicConfig
      });

      if (isOpen && initialTab) setActiveTab(initialTab);
      setHistory([]); // Reset history on open
      setFuture([]); // Reset future
      loadProfiles();
  }, [isOpen, initialSettings, initialCharacter, initialRooms, initialScriptoriumConfig, initialDeepLogicConfig, initialTab]);

  // Firestore Load
  useEffect(() => {
      if (activeTab === 'deeplogic' && isSystemUnlocked && !runtime && settings.firebaseConfig?.apiKey) {
          loadOpsData();
      }
  }, [activeTab, isSystemUnlocked]);

  const loadOpsData = async () => {
      setIsLoadingOps(true);
      try {
          const [r, s, m, t, l] = await Promise.all([
              fetchSettings('runtime'),
              fetchSettings('schedule'),
              fetchSettings('memoryPolicy'),
              fetchSettings('tools'),
              fetchWakeLogs(10)
          ]);
          setRuntime(r);
          setSchedule(s);
          setMemoryPolicy(m);
          setTools(t);
          setLogs(l);
      } catch (e) {
          console.error("Failed to load ops data", e);
      } finally {
          setIsLoadingOps(false);
      }
  };

  // --- UNDO/REDO LOGIC ---
  const saveToHistory = () => {
      const currentState = JSON.stringify({ settings, character, rooms, scriptoriumConfig, deepLogic });
      setHistory(prev => {
          const newHist = [...prev, currentState];
          if (newHist.length > 20) newHist.shift();
          return newHist;
      });
      setFuture([]); 
  };

  const handleUndo = () => {
      if (history.length === 0) return;
      const currentState = JSON.stringify({ settings, character, rooms, scriptoriumConfig, deepLogic });
      setFuture(prev => [...prev, currentState]);
      const lastStateStr = history[history.length - 1];
      const lastState = JSON.parse(lastStateStr);
      setSettings(lastState.settings);
      setCharacter(lastState.character);
      setRooms(lastState.rooms);
      setScriptoriumConfig(lastState.scriptoriumConfig);
      setDeepLogic(lastState.deepLogic);
      setHistory(prev => prev.slice(0, -1));
  };

  const handleRedo = () => {
      if (future.length === 0) return;
      const currentState = JSON.stringify({ settings, character, rooms, scriptoriumConfig, deepLogic });
      setHistory(prev => [...prev, currentState]);
      const nextStateStr = future[future.length - 1];
      const nextState = JSON.parse(nextStateStr);
      setSettings(nextState.settings);
      setCharacter(nextState.character);
      setRooms(nextState.rooms);
      setScriptoriumConfig(nextState.scriptoriumConfig);
      setDeepLogic(nextState.deepLogic);
      setFuture(prev => prev.slice(0, -1));
  };

  const updateSettings = (newSettings: AppSettings) => { saveToHistory(); setSettings(newSettings); };
  const updateCharacter = (newChar: CharacterProfile) => { saveToHistory(); setCharacter(newChar); };
  const updateRooms = (newRooms: Room[]) => { saveToHistory(); setRooms(newRooms); };
  const updateScriptorium = (newConf: ScriptoriumConfig) => { saveToHistory(); setScriptoriumConfig(newConf); };
  const updateDeepLogic = (newDL: DeepLogicConfig) => { saveToHistory(); setDeepLogic(newDL); };

  const isDirty = !isDeepEqual(settings, baseState.settings) || 
                  !isDeepEqual(character, baseState.character) ||
                  !isDeepEqual(rooms, baseState.rooms) ||
                  !isDeepEqual(scriptoriumConfig, baseState.scriptoriumConfig) ||
                  !isDeepEqual(deepLogic, baseState.deepLogic);

  // --- PROFILES LOGIC ---
  const loadProfiles = () => {
      const stored = localStorage.getItem(PROFILE_STORAGE_KEY);
      if (stored) {
          setProfiles(JSON.parse(stored));
      } else {
          const initSlots: ProfileSlot[] = Array(5).fill(null).map((_, i) => ({
              id: i + 1,
              name: `Slot ${i + 1}`,
              timestamp: 0,
              data: null
          }));
          setProfiles(initSlots);
          localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(initSlots));
      }
  };

  const handleProfileSaveAs = (slotId: number) => {
      if (saveAsInput !== "Save As Now") {
          alert("Incorrect confirmation phrase.");
          return;
      }
      const newProfiles = profiles.map(p => {
          if (p.id === slotId) {
              return {
                  ...p,
                  timestamp: Date.now(),
                  data: { settings, character, rooms, scriptoriumConfig, deepLogic }
              };
          }
          return p;
      });
      setProfiles(newProfiles);
      localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(newProfiles));
      setShowSaveAsConfirm(null);
      setSaveAsInput('');
      alert(`Configuration saved to ${newProfiles.find(p => p.id === slotId)?.name}`);
  };

  const handleProfileLoad = (slotId: number) => {
      const slot = profiles.find(p => p.id === slotId);
      if (slot && slot.data) {
          saveToHistory();
          setSettings(slot.data.settings);
          setCharacter(slot.data.character);
          setRooms(slot.data.rooms);
          setScriptoriumConfig(slot.data.scriptoriumConfig);
          setDeepLogic(slot.data.deepLogic);
          alert(`Loaded profile: ${slot.name}`);
      }
  };

  const renameProfile = (slotId: number, newName: string) => {
      const newProfiles = profiles.map(p => p.id === slotId ? { ...p, name: newName } : p);
      setProfiles(newProfiles);
      localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(newProfiles));
  };

  if (!isOpen) return null;

  // --- Handlers ---
  const handleUnlockSystem = () => {
      if (passwordInput === '7vQ!mZ3#Lx9@N2$wR8^pT1&kD6*Hc4?yJ0=G' || !deepLogic.passwordEnabled) {
          setIsSystemUnlocked(true);
      } else {
          alert("Access Denied.");
      }
  };

  const handleTestConnection = async () => {
    setTestStatus('testing');
    let success = false;
    if (settings.activeProvider === 'gemini') success = await testGeminiConnection(settings.apiKeyGemini);
    else success = await testGrokConnection(settings.apiKeyGrok);
    setTestStatus(success ? 'success' : 'failure');
    setTimeout(() => setTestStatus('idle'), 3000);
  };

  const handleFetchRepos = async () => {
      setIsFetchingRepos(true);
      try {
          const repoList = await fetchRepositories(settings.githubToken);
          setRepos(repoList);
      } catch (e) {
          console.error(e);
          setRepos([]);
      } finally {
          setIsFetchingRepos(false);
      }
  };

  const handleBackupNow = async () => {
      setBackupStatus('uploading');
      setBackupErrorLog(null);
      try {
          const storedStateStr = localStorage.getItem('project_cerberus_state_v5');
          if (!storedStateStr) throw new Error("No state to backup");
          const fullState: ChatState = JSON.parse(storedStateStr);
          await performBackup(settings.githubToken, settings.githubRepo, fullState);
          setBackupStatus('success');
      } catch (e: any) {
          console.error(e);
          setBackupErrorLog(e.message + (e.stack ? `\n${e.stack}` : ''));
          setBackupStatus('error');
      } finally {
          setTimeout(() => { if (backupStatus !== 'error') setBackupStatus('idle'); }, 3000);
      }
  };

  const confirmRestore = async () => {
      if (restoreInput !== 'Override' || !onRestore) return;
      setShowRestoreConfirm(false);
      setBackupStatus('restoring');
      setBackupErrorLog(null);
      try {
          const newState = await restoreBackup(settings.githubToken, settings.githubRepo);
          onRestore(newState);
          setBackupStatus('success');
          alert("System State Overwritten.");
      } catch (e: any) {
          console.error(e);
          setBackupErrorLog(e.message + (e.stack ? `\n${e.stack}` : ''));
          setBackupStatus('error');
      } finally {
          setTimeout(() => { if (backupStatus !== 'error') setBackupStatus('idle'); }, 3000);
      }
  };

  const handleSave = async () => {
      if (!isDirty) return;

      let owner = settings.githubOwner;
      let repo = settings.githubRepo;
      if (settings.githubRepo.includes('/')) [owner, repo] = settings.githubRepo.split('/');

      onSave({
          ...settings,
          githubOwner: owner,
          githubRepo: repo
      }, character, rooms, scriptoriumConfig, deepLogic);

      if (isSystemUnlocked && settings.firebaseConfig?.apiKey) {
          if (runtime) await saveSettings('runtime', runtime);
          if (schedule) await saveSettings('schedule', schedule);
          if (memoryPolicy) await saveSettings('memoryPolicy', memoryPolicy);
          if (tools) await saveSettings('tools', tools);
      }

      setSaveStatus('success');
      setBaseState({ settings, character, rooms, scriptoriumConfig, deepLogic });
      setHistory([]);
      setFuture([]);
      setTimeout(() => setSaveStatus('idle'), 2000);
  };

  const handleAddRoom = () => updateRooms([...rooms, { id: uuidv4(), name: 'New Location', description: 'Description...', backgroundImage: '' }]);
  const handleDeleteRoom = (id: string) => rooms.length > 1 && updateRooms(rooms.filter(r => r.id !== id));
  const handleUpdateRoom = (id: string, field: keyof Room, value: string) => updateRooms(rooms.map(r => r.id === id ? { ...r, [field]: value } : r));
  const updateFirebaseConfig = (key: keyof FirebaseConfig, value: string) => {
      const current = settings.firebaseConfig || {} as FirebaseConfig;
      updateSettings({ ...settings, firebaseConfig: { ...current, [key]: value } });
  };
  const toggleTooltip = (key: string) => { if (activeTooltip === key) setActiveTooltip(null); else setActiveTooltip(key); };
  const isFlashModel = settings.modelGemini.toLowerCase().includes('flash');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-hidden">
      <div className="bg-cerberus-900 border border-cerberus-700 w-full max-w-2xl rounded-lg shadow-2xl flex flex-col max-h-[85dvh] h-full overflow-hidden">
        
        {/* Header */}
        <div className="shrink-0 flex justify-between items-center p-4 border-b border-cerberus-800 bg-cerberus-900 z-10">
          <h2 className="text-xl font-serif text-cerberus-accent">Configuration</h2>
          <div className="flex items-center gap-4">
               {/* Clean Text Undo/Redo */}
               <div className="flex items-center border border-cerberus-700 rounded-md overflow-hidden bg-black/40 h-7">
                   <button 
                       onClick={handleUndo} 
                       disabled={history.length === 0}
                       className={`px-3 h-full text-[10px] font-bold uppercase tracking-widest transition-colors border-r border-cerberus-700 flex items-center ${history.length > 0 ? 'text-gray-300 hover:bg-cerberus-800 hover:text-white' : 'text-gray-700 cursor-not-allowed'}`}
                       title="Undo"
                   >
                       UNDO
                   </button>
                   <button 
                       onClick={handleRedo} 
                       disabled={future.length === 0}
                       className={`px-3 h-full text-[10px] font-bold uppercase tracking-widest transition-colors flex items-center ${future.length > 0 ? 'text-gray-300 hover:bg-cerberus-800 hover:text-white' : 'text-gray-700 cursor-not-allowed'}`}
                       title="Redo"
                   >
                       REDO
                   </button>
               </div>
               <div className="h-4 w-px bg-cerberus-700"></div>
               <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={24} /></button>
          </div>
        </div>

        {/* Tabs */}
        <div className="shrink-0 flex border-b border-cerberus-800 overflow-x-auto bg-cerberus-900 z-10">
          {(['api', 'character', 'appearance', 'locations', 'scriptorium', 'profiles', 'backups', 'deeplogic'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-3 px-4 text-xs font-medium uppercase tracking-wider transition-colors whitespace-nowrap ${activeTab === tab ? 'bg-cerberus-800 text-cerberus-accent' : 'text-gray-500 hover:bg-cerberus-800/50'}`}
            >
              {tab === 'deeplogic' ? 'Deep Logic' : (tab === 'profiles' ? 'Profiles' : tab)}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-cerberus-900/50" onScroll={() => setActiveTooltip(null)}>
          
          {/* API */}
          {activeTab === 'api' && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-bold text-gray-400 mb-2">Active Provider</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer"><input type="radio" checked={settings.activeProvider === 'gemini'} onChange={() => updateSettings({...settings, activeProvider: 'gemini'})} className="text-cerberus-600 focus:ring-cerberus-500" /><span className="text-gray-200">Google Gemini</span></label>
                  <label className="flex items-center gap-2 cursor-pointer"><input type="radio" checked={settings.activeProvider === 'grok'} onChange={() => updateSettings({...settings, activeProvider: 'grok'})} className="text-cerberus-600 focus:ring-cerberus-500" /><span className="text-gray-200">xAI Grok</span></label>
                </div>
              </div>

              {settings.activeProvider === 'gemini' && (
                  <div className="space-y-4 border-l-2 border-cerberus-600 pl-4 animate-fadeIn">
                      <div><label className="block text-xs font-mono text-cerberus-accent mb-1">GEMINI API KEY</label><input type="password" value={settings.apiKeyGemini} onChange={(e) => updateSettings({...settings, apiKeyGemini: e.target.value})} className="w-full bg-black/50 border border-cerberus-700 rounded p-2 text-white focus:border-cerberus-500 focus:outline-none font-mono text-sm" /></div>
                      <div>
                          <label className="block text-xs font-mono text-cerberus-accent mb-1">MODEL SELECTOR</label>
                          <select value={settings.modelGemini} onChange={e => updateSettings({...settings, modelGemini: e.target.value})} className="w-full bg-black/50 border border-cerberus-700 rounded p-2 text-white focus:border-cerberus-500 outline-none text-sm">
                              <option value="gemini-3-pro-preview">Gemini 3 Pro Preview</option>
                              <option value="gemini-3-flash-preview">Gemini 3 Flash Preview</option>
                              <option value="gemini-2.5-pro-latest">Gemini 2.5 Pro</option>
                              <option value="gemini-2.5-flash-latest">Gemini 2.5 Flash</option>
                          </select>
                      </div>
                  </div>
              )}
              {settings.activeProvider === 'grok' && (
                  <div className="space-y-4 border-l-2 border-cerberus-600 pl-4 animate-fadeIn">
                      <div><label className="block text-xs font-mono text-cerberus-accent mb-1">GROK API KEY</label><input type="password" value={settings.apiKeyGrok} onChange={(e) => updateSettings({...settings, apiKeyGrok: e.target.value})} className="w-full bg-black/50 border border-cerberus-700 rounded p-2 text-white focus:border-cerberus-500 focus:outline-none font-mono text-sm" /></div>
                      <div>
                          <label className="block text-xs font-mono text-cerberus-accent mb-1">MODEL SELECTOR</label>
                          <select value={settings.modelGrok} onChange={e => updateSettings({...settings, modelGrok: e.target.value})} className="w-full bg-black/50 border border-cerberus-700 rounded p-2 text-white focus:border-cerberus-500 outline-none text-sm">
                              <option value="grok-beta">Grok Beta</option>
                              <option value="grok-vision-beta">Grok Vision Beta</option>
                          </select>
                      </div>
                  </div>
              )}
              
              <div className="pt-2"><button onClick={handleTestConnection} disabled={testStatus === 'testing'} className={`px-4 py-2 rounded text-sm font-bold uppercase tracking-wider ${testStatus === 'success' ? 'bg-green-900 text-green-200' : 'bg-cerberus-700 text-white'}`}>{testStatus === 'testing' ? 'Testing...' : 'Test Connection'}</button></div>

              {/* GENERATION PARAMETERS (UNIFIED CARD) */}
              <div className="mt-8 pt-6 border-t border-cerberus-800">
                  <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2 text-cerberus-accent font-serif tracking-widest text-xs uppercase"><Sliders size={16} /> Generation Parameters</div>
                      <button onClick={() => setIsFineTuningLocked(!isFineTuningLocked)} className="text-gray-500 hover:text-white transition-colors">{isFineTuningLocked ? <Lock size={14} /> : <Unlock size={14} className="text-cerberus-accent" />}</button>
                  </div>
                  
                  <div className={`border border-cerberus-800 rounded p-5 bg-cerberus-900/30 space-y-6 transition-all duration-300 ${isFineTuningLocked ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
                      
                      {/* Max Output */}
                      <div>
                          <label className="block text-[10px] font-mono text-gray-400 mb-2 flex justify-between"><span>MAX OUTPUT TOKENS</span> <span className="text-white font-bold">{settings.maxOutputTokens || 2048}</span></label>
                          <input type="range" min="256" max="8192" step="50" value={settings.maxOutputTokens || 2048} onChange={(e) => updateSettings({...settings, maxOutputTokens: parseInt(e.target.value)})} className="w-full accent-cerberus-600 cursor-pointer"/>
                      </div>

                      {/* Thinking Budget */}
                      <div>
                           <label className="block text-[10px] font-mono text-gray-400 mb-2 flex justify-between"><span>THINKING BUDGET ({settings.thinkingBudgetPercentage}%)</span> <span className="text-gray-500 italic text-[9px]">Gemini 2.5/3 Only</span></label>
                           <input type="range" min="0" max="100" step="5" value={settings.thinkingBudgetPercentage || 0} onChange={(e) => updateSettings({...settings, thinkingBudgetPercentage: parseInt(e.target.value)})} className="w-full accent-cerberus-600 cursor-pointer"/>
                      </div>

                      {/* Target Length */}
                      <div>
                          <label className="block text-[10px] font-mono text-gray-400 mb-2 flex justify-between"><span>TARGET LENGTH</span> <span className="text-white font-bold">{settings.tokenTarget || 300} tokens</span></label>
                          <input type="range" min="50" max="2000" step="50" value={settings.tokenTarget || 300} onChange={(e) => updateSettings({...settings, tokenTarget: parseInt(e.target.value)})} className="w-full accent-cerberus-600 cursor-pointer"/>
                      </div>

                      <div className="h-px bg-cerberus-800/50 w-full" />

                      {/* Fine Tuning Grid */}
                      <div className="grid grid-cols-2 gap-6">
                          <div>
                              <label className="block text-[10px] font-mono text-gray-400 mb-2 flex justify-between"><span>TEMPERATURE ({settings.temperature})</span></label>
                              <input type="range" min="0" max="2" step="0.1" value={settings.temperature} onChange={(e) => updateSettings({...settings, temperature: parseFloat(e.target.value)})} className="w-full accent-cerberus-600"/>
                          </div>
                          <div>
                              <label className="block text-[10px] font-mono text-gray-400 mb-2 flex justify-between"><span>TOP P ({settings.topP || 0.95})</span></label>
                              <input type="range" min="0" max="1" step="0.05" value={settings.topP || 0.95} onChange={(e) => updateSettings({...settings, topP: parseFloat(e.target.value)})} className="w-full accent-cerberus-600"/>
                          </div>
                          <div>
                              <label className="block text-[10px] font-mono text-gray-400 mb-2 flex justify-between"><span>PRESENCE PENALTY ({settings.presencePenalty})</span></label>
                              <input type="range" min="-2" max="2" step="0.1" value={settings.presencePenalty || 0} onChange={(e) => updateSettings({...settings, presencePenalty: parseFloat(e.target.value)})} className="w-full accent-cerberus-600"/>
                          </div>
                          <div>
                              <label className="block text-[10px] font-mono text-gray-400 mb-2 flex justify-between"><span>FREQUENCY PENALTY ({settings.frequencyPenalty})</span></label>
                              <input type="range" min="-2" max="2" step="0.1" value={settings.frequencyPenalty || 0} onChange={(e) => updateSettings({...settings, frequencyPenalty: parseFloat(e.target.value)})} className="w-full accent-cerberus-600"/>
                          </div>
                      </div>
                  </div>
              </div>
            </div>
          )}

          {/* Character */}
          {activeTab === 'character' && (
             <div className="space-y-6">
                 <div><label className="block text-xs font-mono text-cerberus-accent mb-1">CHARACTER NAME</label><input type="text" value={character.name} onChange={(e) => updateCharacter({...character, name: e.target.value})} className="w-full bg-black/50 border border-cerberus-700 rounded p-2 text-white focus:border-cerberus-500" /></div>
                 <div><label className="block text-xs font-mono text-cerberus-accent mb-1">USER NAME</label><input type="text" value={settings.userName} onChange={(e) => updateSettings({...settings, userName: e.target.value})} className="w-full bg-black/50 border border-cerberus-700 rounded p-2 text-white focus:border-cerberus-500" /></div>
                 <div><label className="block text-xs font-mono text-cerberus-accent mb-1">USER DESCRIPTION</label><textarea value={settings.userDescription || ''} onChange={(e) => updateSettings({...settings, userDescription: e.target.value})} className="w-full h-24 bg-black/50 border border-cerberus-700 rounded p-2 text-gray-300 text-xs font-mono leading-relaxed focus:border-cerberus-500 custom-scrollbar" /></div>
                 <div><label className="block text-xs font-mono text-cerberus-accent mb-1">SYSTEM PROMPT</label><textarea value={character.systemPrompt} onChange={(e) => updateCharacter({...character, systemPrompt: e.target.value})} className="w-full h-64 bg-black/50 border border-cerberus-700 rounded p-2 text-gray-300 text-xs font-mono leading-relaxed focus:border-cerberus-500 custom-scrollbar" /></div>
             </div>
          )}

          {/* Appearance (RESTORED) */}
          {activeTab === 'appearance' && (
              <div className="space-y-6">
                 {/* Visual Identity */}
                 <div className="p-4 border border-cerberus-800 rounded bg-cerberus-900/40 space-y-4">
                     <h3 className="text-xs font-serif text-cerberus-accent border-b border-cerberus-800 pb-2 flex items-center gap-2"><Maximize size={14}/> Visual Identity</h3>
                     <div><label className="block text-[10px] font-mono text-gray-400 mb-1">PORTRAIT URL</label><input type="text" value={character.portraitUrl} onChange={(e) => updateCharacter({...character, portraitUrl: e.target.value})} className="w-full bg-cerberus-900 border border-cerberus-700 rounded p-1.5 text-xs text-white" /></div>
                     <div className="grid grid-cols-2 gap-4">
                         <div><label className="block text-[10px] font-mono text-gray-400 mb-2">SCALE ({settings.portraitScale}x)</label><input type="range" min="0.5" max="3.0" step="0.1" value={settings.portraitScale} onChange={(e) => updateSettings({...settings, portraitScale: parseFloat(e.target.value)})} className="w-full accent-cerberus-600" /></div>
                         <div><label className="block text-[10px] font-mono text-gray-400 mb-1">ASPECT</label><select value={settings.portraitAspectRatio} onChange={e => updateSettings({...settings, portraitAspectRatio: e.target.value as any})} className="w-full bg-cerberus-900 border border-cerberus-700 rounded p-1.5 text-xs text-white outline-none"><option value="1/1">1:1 Square</option><option value="4/5">4:5 Vertical</option><option value="9/16">9:16 Mobile Full</option></select></div>
                     </div>
                     <div><label className="block text-[10px] font-mono text-gray-400 mb-2">BG BRIGHTNESS ({settings.bgBrightness}%)</label><input type="range" min="0" max="100" step="5" value={settings.bgBrightness} onChange={(e) => updateSettings({...settings, bgBrightness: parseInt(e.target.value)})} className="w-full accent-cerberus-600" /></div>
                 </div>

                 {/* Entity Aesthetics */}
                 <div className="p-4 border border-cerberus-800 rounded bg-cerberus-900/40 space-y-4">
                     <h3 className="text-xs font-serif text-cerberus-accent border-b border-cerberus-800 pb-2 flex items-center gap-2"><Sparkles size={14}/> Entity Voice</h3>
                     <div><label className="block text-[10px] font-mono text-gray-400 mb-1">FONT URL (GOOGLE)</label><input type="text" value={settings.aiTextFontUrl || ''} onChange={(e) => updateSettings({...settings, aiTextFontUrl: e.target.value})} placeholder="https://fonts.googleapis.com..." className="w-full bg-cerberus-900 border border-cerberus-700 rounded p-1.5 text-xs text-white" /></div>
                     <div><label className="block text-[10px] font-mono text-gray-400 mb-2">SIZE ({settings.aiTextSize || 16}px)</label><input type="range" min="10" max="32" step="1" value={settings.aiTextSize || 16} onChange={(e) => updateSettings({...settings, aiTextSize: parseInt(e.target.value)})} className="w-full accent-cerberus-600" /></div>
                     <div className="grid grid-cols-2 gap-4">
                         <div><label className="block text-[10px] font-mono text-gray-400 mb-1">COLOR</label><input type="text" value={settings.aiTextColor || '#fce7f3'} onChange={(e) => updateSettings({...settings, aiTextColor: e.target.value})} className="w-full bg-cerberus-900 border border-cerberus-700 rounded p-1.5 text-xs text-white" /></div>
                         <div>
                             <label className="block text-[10px] font-mono text-gray-400 mb-1">EFFECT</label>
                             <select value={settings.aiTextStyle || 'none'} onChange={(e) => updateSettings({...settings, aiTextStyle: e.target.value as any})} className="w-full bg-cerberus-900 border border-cerberus-700 rounded p-1.5 text-xs text-white outline-none">
                                 <option value="none">None</option>
                                 <option value="shadow">Drop Shadow</option>
                                 <option value="outline">Subtle Outline</option>
                                 <option value="neon">Neon Glow</option>
                             </select>
                         </div>
                     </div>
                 </div>

                 {/* User Aesthetics */}
                 <div className="p-4 border border-cerberus-800 rounded bg-cerberus-900/40 space-y-4">
                     <h3 className="text-xs font-serif text-cerberus-accent border-b border-cerberus-800 pb-2 flex items-center gap-2"><User size={14}/> User Voice</h3>
                     <div><label className="block text-[10px] font-mono text-gray-400 mb-1">FONT URL (GOOGLE)</label><input type="text" value={settings.userTextFontUrl || ''} onChange={(e) => updateSettings({...settings, userTextFontUrl: e.target.value})} placeholder="https://fonts.googleapis.com..." className="w-full bg-cerberus-900 border border-cerberus-700 rounded p-1.5 text-xs text-white" /></div>
                     <div><label className="block text-[10px] font-mono text-gray-400 mb-2">SIZE ({settings.userTextSize || 14}px)</label><input type="range" min="10" max="32" step="1" value={settings.userTextSize || 14} onChange={(e) => updateSettings({...settings, userTextSize: parseInt(e.target.value)})} className="w-full accent-cerberus-600" /></div>
                     <div><label className="block text-[10px] font-mono text-gray-400 mb-1">COLOR</label><input type="text" value={settings.userTextColor || '#d1d5db'} onChange={(e) => updateSettings({...settings, userTextColor: e.target.value})} className="w-full bg-cerberus-900 border border-cerberus-700 rounded p-1.5 text-xs text-white" /></div>
                 </div>
                 
                 <div className="p-4 border border-cerberus-800 rounded bg-cerberus-900/40 flex items-center justify-between">
                     <span className="text-xs font-mono text-cerberus-accent">ENTER KEY SENDS MESSAGE</span>
                     <label className="relative inline-flex items-center cursor-pointer">
                         <input type="checkbox" checked={settings.enterToSend} onChange={(e) => updateSettings({...settings, enterToSend: e.target.checked})} className="sr-only peer" />
                         <div className="w-9 h-5 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:bg-cerberus-600 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all"></div>
                     </label>
                 </div>
              </div>
          )}

          {/* Locations */}
          {activeTab === 'locations' && (
              <div className="space-y-8">
                  <button onClick={handleAddRoom} className="w-full py-2 bg-cerberus-800 hover:bg-cerberus-700 text-cerberus-accent text-xs uppercase tracking-widest border border-cerberus-600 rounded flex items-center justify-center gap-2"><Plus size={14} /> Add Location</button>
                  <div className="space-y-6">{rooms.map((room) => (<div key={room.id} className="p-4 bg-black/30 border border-cerberus-800 rounded relative group"><button onClick={() => handleDeleteRoom(room.id)} className="absolute top-2 right-2 text-gray-600 hover:text-red-500 p-1"><Trash2 size={14} /></button><div className="space-y-3"><div><label className="block text-[10px] font-mono text-cerberus-accent mb-1">NAME</label><input type="text" value={room.name} onChange={(e) => handleUpdateRoom(room.id, 'name', e.target.value)} className="w-full bg-cerberus-900/50 border border-cerberus-800 rounded p-1.5 text-gray-200 text-sm focus:border-cerberus-500 outline-none" /></div><div><label className="block text-[10px] font-mono text-cerberus-accent mb-1">DESCRIPTION</label><textarea value={room.description} onChange={(e) => handleUpdateRoom(room.id, 'description', e.target.value)} className="w-full bg-cerberus-900/50 border border-cerberus-800 rounded p-1.5 text-gray-400 text-xs focus:border-cerberus-500 outline-none h-16 resize-none custom-scrollbar" /></div><div><label className="block text-[10px] font-mono text-cerberus-accent mb-1">BACKGROUND IMAGE URL</label><input type="text" value={room.backgroundImage} onChange={(e) => handleUpdateRoom(room.id, 'backgroundImage', e.target.value)} className="w-full bg-cerberus-900/50 border border-cerberus-800 rounded p-1.5 text-gray-500 text-xs focus:border-cerberus-500 outline-none font-mono" /></div></div></div>))}</div>
              </div>
          )}

          {/* Scriptorium */}
          {activeTab === 'scriptorium' && (
              <div className="space-y-6">
                  <div className="p-4 bg-black/30 border border-cerberus-800 rounded">
                      <h3 className="flex items-center gap-2 text-white font-serif mb-4"><ScrollText size={20} /> Scriptorium Config</h3>
                      <div className="space-y-4">
                          <div><label className="block text-[10px] font-mono text-cerberus-accent mb-1">BACKDROP IMAGE URL</label><input type="text" value={scriptoriumConfig.backgroundImage} onChange={e => updateScriptorium({...scriptoriumConfig, backgroundImage: e.target.value})} className="w-full bg-cerberus-900 border border-cerberus-700 rounded p-2 text-sm text-white focus:border-cerberus-500" /></div>
                          <div><label className="block text-[10px] font-mono text-cerberus-accent mb-1">SYSTEM PROMPT (ADMINISTRATOR)</label><textarea value={scriptoriumConfig.systemPrompt} onChange={e => updateScriptorium({...scriptoriumConfig, systemPrompt: e.target.value})} className="w-full h-48 bg-cerberus-900 border border-cerberus-700 rounded p-2 text-sm text-white focus:border-cerberus-500 custom-scrollbar" /></div>
                      </div>
                  </div>
              </div>
          )}

          {/* PROFILES - OPTIMIZED LAYOUT */}
          {activeTab === 'profiles' && (
              <div className="space-y-6">
                  <div className="flex items-center justify-between">
                      <h3 className="text-xs font-serif text-cerberus-accent uppercase tracking-widest flex items-center gap-2"><HardDrive size={16}/> Configuration Profiles</h3>
                      <span className="text-[10px] text-gray-500 italic">Saved locally to this browser</span>
                  </div>
                  
                  <div className="space-y-6">
                      {profiles.map(slot => (
                          <div key={slot.id} className={`p-5 border rounded-lg bg-cerberus-900/40 transition-all ${showSaveAsConfirm === slot.id ? 'border-red-500 bg-red-950/20 shadow-[0_0_15px_rgba(239,68,68,0.2)]' : (slot.data ? 'border-cerberus-600' : 'border-cerberus-800 opacity-70')}`}>
                              
                              {showSaveAsConfirm === slot.id ? (
                                  <div className="space-y-4 animate-fadeIn">
                                      <p className="text-xs text-red-400 font-bold uppercase tracking-widest flex items-center gap-2 border-b border-red-900 pb-2 mb-2"><AlertCircle size={14}/> OVERWRITE CONFIRMATION</p>
                                      <p className="text-[11px] text-gray-300 leading-relaxed">
                                          You are about to overwrite <span className="text-white font-bold">"{slot.name}"</span> with the current system state. This cannot be undone.
                                          Type <span className="text-cerberus-accent font-mono border border-cerberus-700 px-1 rounded bg-black">Save As Now</span> to confirm.
                                      </p>
                                      <div className="flex flex-col md:flex-row gap-3">
                                          <input 
                                              value={saveAsInput} 
                                              onChange={e => setSaveAsInput(e.target.value)} 
                                              className="flex-1 bg-black border border-red-900 rounded px-3 py-2 text-sm text-white outline-none focus:border-red-500 placeholder-red-900" 
                                              placeholder="Type phrase here..."
                                          />
                                          <div className="flex gap-2 shrink-0">
                                              <button onClick={() => handleProfileSaveAs(slot.id)} className="px-4 py-2 bg-red-900 text-white text-xs font-bold rounded hover:bg-red-700 uppercase tracking-wide border border-red-700">CONFIRM</button>
                                              <button onClick={() => { setShowSaveAsConfirm(null); setSaveAsInput(''); }} className="px-4 py-2 border border-gray-700 text-gray-400 text-xs font-bold rounded hover:text-white hover:border-gray-500 uppercase tracking-wide">CANCEL</button>
                                          </div>
                                      </div>
                                  </div>
                              ) : (
                                  <div className="flex flex-col md:flex-row items-center gap-4">
                                      <div className={`w-10 h-10 shrink-0 rounded flex items-center justify-center font-mono font-bold text-sm border ${slot.data ? 'bg-cerberus-800 text-cerberus-accent border-cerberus-600' : 'bg-gray-900 text-gray-600 border-gray-800'}`}>
                                          {slot.id}
                                      </div>
                                      <div className="flex-1 min-w-0 w-full">
                                          <input 
                                              value={slot.name} 
                                              onChange={e => renameProfile(slot.id, e.target.value)} 
                                              className="bg-transparent border-b border-transparent hover:border-gray-700 focus:border-cerberus-accent text-base font-serif text-white focus:outline-none w-full transition-colors pb-0.5"
                                              placeholder="Profile Name"
                                          />
                                          <div className="text-[10px] text-gray-500 font-mono mt-2 flex items-center gap-2">
                                              {slot.timestamp ? (
                                                  <>
                                                      <Clock size={10} />
                                                      {new Date(slot.timestamp).toLocaleString()}
                                                  </>
                                              ) : 'Empty Slot'}
                                          </div>
                                      </div>
                                      
                                      <div className="flex items-center gap-2 w-full md:w-auto mt-2 md:mt-0">
                                          <button 
                                              onClick={() => setShowSaveAsConfirm(slot.id)} 
                                              className="flex-1 md:flex-none flex items-center justify-center gap-1.5 px-4 py-2 rounded bg-cerberus-900 border border-cerberus-700 hover:border-cerberus-500 text-gray-300 hover:text-white transition-colors text-[10px] uppercase font-bold tracking-wider"
                                          >
                                              <Download size={12}/> Save As
                                          </button>
                                          {slot.data && (
                                              <button 
                                                  onClick={() => handleProfileLoad(slot.id)} 
                                                  className="flex-1 md:flex-none flex items-center justify-center gap-1.5 px-4 py-2 rounded bg-cerberus-700 hover:bg-cerberus-600 text-white transition-colors text-[10px] uppercase font-bold tracking-wider border border-transparent shadow-lg"
                                              >
                                                  <Upload size={12}/> Load
                                              </button>
                                          )}
                                      </div>
                                  </div>
                              )}
                          </div>
                      ))}
                  </div>
              </div>
          )}

          {activeTab === 'backups' && (
               <div className="space-y-6">
                   <div className="p-4 bg-black/30 border border-cerberus-800 rounded">
                       <h3 className="flex items-center gap-2 text-white font-serif mb-4"><Github size={20} /> GitHub Backup</h3>
                       <div className="space-y-4">
                           <div><label className="block text-[10px] font-mono text-cerberus-accent mb-1">PERSONAL ACCESS TOKEN</label><input type="password" value={settings.githubToken} onChange={(e) => updateSettings({...settings, githubToken: e.target.value})} className="w-full bg-cerberus-900 border border-cerberus-700 rounded p-2 text-sm text-white focus:border-cerberus-500" /><button onClick={handleFetchRepos} className="text-[10px] text-cerberus-accent mt-1 hover:underline">Refresh Repos</button></div>
                           <div><label className="block text-[10px] font-mono text-cerberus-accent mb-1">REPOSITORY</label><select value={settings.githubRepo} onChange={(e) => updateSettings({...settings, githubRepo: e.target.value})} className="w-full bg-cerberus-900 border border-cerberus-700 rounded p-2 text-sm text-white focus:border-cerberus-500"><option value="">Select...</option>{settings.githubRepo && !repos.includes(settings.githubRepo) && (<option value={settings.githubRepo}>{settings.githubRepo}</option>)}{repos.map(r => (<option key={r} value={r}>{r}</option>))}</select></div>
                           <div className="pt-4 border-t border-cerberus-800 space-y-4"><button onClick={handleBackupNow} disabled={backupStatus === 'uploading' || !settings.githubRepo} className="w-full py-3 bg-cerberus-600 text-white rounded font-bold uppercase text-xs">Push Backup</button><button onClick={() => setShowRestoreConfirm(true)} disabled={backupStatus === 'uploading' || !settings.githubRepo} className="w-full py-3 border border-red-800 text-red-500 rounded font-bold uppercase text-xs">Restore Backup</button></div>
                           
                           {showRestoreConfirm && (<div className="p-4 bg-red-900/20 border border-red-800 rounded mt-4"><p className="text-red-400 text-xs mb-2">Type "Override" to confirm restore.</p><div className="flex gap-2"><input value={restoreInput} onChange={e => setRestoreInput(e.target.value)} className="bg-black border border-red-800 text-red-500 p-1 flex-1" /><button onClick={confirmRestore} className="px-3 bg-red-800 text-white text-xs">OK</button></div></div>)}
                           
                           {/* ERROR LOG BOX */}
                           {backupErrorLog && (
                                <div className="mt-4 p-3 bg-red-950/30 border border-red-500/50 rounded relative group animate-fadeIn">
                                    <h4 className="text-red-400 text-[10px] font-bold uppercase mb-2 flex items-center gap-2"><AlertCircle size={12}/> Error Report</h4>
                                    <pre className="text-[10px] font-mono text-red-300 whitespace-pre-wrap overflow-auto max-h-32 p-2 bg-black/50 rounded border border-red-900/50 scrollbar-thin">
                                        {backupErrorLog}
                                    </pre>
                                    <button 
                                        onClick={() => navigator.clipboard.writeText(backupErrorLog)} 
                                        className="absolute top-2 right-2 p-1.5 bg-red-900 hover:bg-red-800 text-white text-[9px] rounded flex items-center gap-1 transition-colors"
                                        title="Copy to Clipboard"
                                    >
                                        <Copy size={10} /> COPY
                                    </button>
                                </div>
                           )}
                       </div>
                   </div>
               </div>
           )}

           {/* Deep Logic Tab */}
           {activeTab === 'deeplogic' && (
               <div className="h-full flex flex-col">
                   {!isSystemUnlocked ? (
                       <div className="flex-1 flex flex-col items-center justify-center space-y-6 animate-fadeIn p-8">
                           <Lock size={48} className="text-red-600 animate-pulse" />
                           <div className="text-center"><h3 className="text-xl font-serif text-red-500 tracking-[0.2em] mb-2">SYSTEM CORE LOCKED</h3><p className="text-xs text-gray-500 font-mono">Restricted Access Protocol</p></div>
                           <input type="password" value={passwordInput} onChange={e => setPasswordInput(e.target.value)} placeholder="ENTER PASSPHRASE" className="bg-black border border-red-900 rounded px-4 py-2 text-red-500 font-mono text-center focus:border-red-500 focus:outline-none w-64" onKeyDown={e => e.key === 'Enter' && handleUnlockSystem()} /><button onClick={handleUnlockSystem} className="px-6 py-2 bg-red-900/20 text-red-500 border border-red-900 hover:bg-red-900/40 rounded uppercase tracking-widest text-xs">Authenticate</button>
                       </div>
                   ) : (
                       <div className="flex flex-col h-full">
                           <div className="flex border-b border-cerberus-800 bg-black/20 px-4">
                               <button onClick={() => setDeepLogicSubTab('core')} className={`px-4 py-3 text-[10px] uppercase font-bold tracking-wider border-b-2 transition-colors ${deepLogicSubTab === 'core' ? 'border-cerberus-accent text-cerberus-accent' : 'border-transparent text-gray-500'}`}>Core Logic</button>
                               <button onClick={() => setDeepLogicSubTab('memory')} className={`px-4 py-3 text-[10px] uppercase font-bold tracking-wider border-b-2 transition-colors ${deepLogicSubTab === 'memory' ? 'border-cerberus-accent text-cerberus-accent' : 'border-transparent text-gray-500'}`}>Persistence</button>
                               <button onClick={() => setDeepLogicSubTab('automation')} className={`px-4 py-3 text-[10px] uppercase font-bold tracking-wider border-b-2 transition-colors ${deepLogicSubTab === 'automation' ? 'border-cerberus-accent text-cerberus-accent' : 'border-transparent text-gray-500'}`}>Automation</button>
                           </div>
                           <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                               {deepLogicSubTab === 'core' && (<div className="space-y-6 animate-fadeIn"><div className="p-4 border border-red-900/50 bg-red-950/10 rounded"><div className="flex justify-between items-center mb-2"><span className="text-red-500 font-bold text-xs uppercase flex items-center gap-2"><Power size={14}/> EMERGENCY KILL SWITCH</span><input type="checkbox" checked={deepLogic.killSwitch} onChange={e => updateDeepLogic({...deepLogic, killSwitch: e.target.checked})} className="accent-red-600 w-4 h-4"/></div><p className="text-[10px] text-gray-500">Completely disables all autonomous agentic loops.</p></div><div className="p-4 border border-yellow-900/50 bg-yellow-950/10 rounded"><div className="flex justify-between items-center mb-2"><span className="text-yellow-500 font-bold text-xs uppercase flex items-center gap-2"><Terminal size={14}/> SIMULATION MODE</span><input type="checkbox" checked={deepLogic.simulationMode} onChange={e => updateDeepLogic({...deepLogic, simulationMode: e.target.checked})} className="accent-yellow-600 w-4 h-4"/></div><p className="text-[10px] text-gray-500">Actions are logged but not executed via APIs.</p></div></div>)}
                               {deepLogicSubTab === 'memory' && (<div className="space-y-6 animate-fadeIn"><div className="p-4 bg-black/30 border border-cerberus-800 rounded"><h3 className="flex items-center gap-2 text-white font-serif mb-4"><Database size={20}/> Firebase Credentials</h3><div className="grid grid-cols-1 gap-3"><div><label className="block text-[10px] font-mono text-gray-500 mb-1">API KEY</label><input type="password" value={settings.firebaseConfig?.apiKey || ''} onChange={e => updateFirebaseConfig('apiKey', e.target.value)} className="w-full bg-cerberus-900 border border-cerberus-800 rounded p-2 text-xs text-white" /></div><div><label className="block text-[10px] font-mono text-gray-500 mb-1">PROJECT ID</label><input type="text" value={settings.firebaseConfig?.projectId || ''} onChange={e => updateFirebaseConfig('projectId', e.target.value)} className="w-full bg-cerberus-900 border border-cerberus-800 rounded p-2 text-xs text-white" /></div><div><label className="block text-[10px] font-mono text-gray-500 mb-1">AUTH DOMAIN</label><input type="text" value={settings.firebaseConfig?.authDomain || ''} onChange={e => updateFirebaseConfig('authDomain', e.target.value)} className="w-full bg-cerberus-900 border border-cerberus-800 rounded p-2 text-xs text-white" /></div><div><label className="block text-[10px] font-mono text-gray-500 mb-1">STORAGE BUCKET</label><input type="text" value={settings.firebaseConfig?.storageBucket || ''} onChange={e => updateFirebaseConfig('storageBucket', e.target.value)} className="w-full bg-cerberus-900 border border-cerberus-800 rounded p-2 text-xs text-white" /></div><div><label className="block text-[10px] font-mono text-gray-500 mb-1">MSG SENDER ID</label><input type="text" value={settings.firebaseConfig?.messagingSenderId || ''} onChange={e => updateFirebaseConfig('messagingSenderId', e.target.value)} className="w-full bg-cerberus-900 border border-cerberus-800 rounded p-2 text-xs text-white" /></div><div><label className="block text-[10px] font-mono text-gray-500 mb-1">APP ID</label><input type="text" value={settings.firebaseConfig?.appId || ''} onChange={e => updateFirebaseConfig('appId', e.target.value)} className="w-full bg-cerberus-900 border border-cerberus-800 rounded p-2 text-xs text-white" /></div></div></div></div>)}
                               {deepLogicSubTab === 'automation' && (<div className="text-center text-gray-500 italic mt-8">Load Firebase Credentials to access Automation</div>)} 
                           </div>
                       </div>
                   )}
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