
import React, { useState, useEffect } from 'react';
import { db, requestPersistentStorage } from '../services/organizerDb';
import { encryptApiKey, decryptApiKey } from '../services/encryptionService';
import { testGeminiConnection } from '../services/geminiService';
import { testGrokConnection } from '../services/grokService';
import { AppSettings } from '../types';
import { Shield, Lock, Unlock, Key, Check, AlertCircle, Save, Loader2, RefreshCw, Trash2, Zap, Eye, EyeOff } from 'lucide-react';

interface KeyManagerProps {
    mode: 'onboarding' | 'unlock' | 'settings';
    onKeysReady: (keys: Partial<AppSettings>) => void;
    onClose?: () => void;
    existingKeys?: Partial<AppSettings>;
}

type Provider = 'gemini' | 'grok' | 'openai';
type TestStatus = 'idle' | 'testing' | 'success' | 'error';

const KeyManager: React.FC<KeyManagerProps> = ({ mode, onKeysReady, onClose, existingKeys }) => {
    // View State
    const [activeProvider, setActiveProvider] = useState<Provider>('gemini');
    
    // Data State (Persists across tabs)
    const [draftKeys, setDraftKeys] = useState<Record<Provider, string>>({
        gemini: '',
        grok: '',
        openai: ''
    });
    
    const [testStatuses, setTestStatuses] = useState<Record<Provider, TestStatus>>({
        gemini: 'idle',
        grok: 'idle',
        openai: 'idle'
    });

    const [showKey, setShowKey] = useState(false);

    // Storage Config
    const [storageMode, setStorageMode] = useState<'session' | 'encrypted'>('session');
    const [pin, setPin] = useState('');
    const [pinConfirm, setPinConfirm] = useState('');
    const [unlockError, setUnlockError] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [isSecure, setIsSecure] = useState(true);

    // Load existing keys on mount
    useEffect(() => {
        setIsSecure(window.isSecureContext);
        if (!window.isSecureContext) setStorageMode('session');

        if (existingKeys) {
            setDraftKeys({
                gemini: existingKeys.apiKeyGemini || '',
                grok: existingKeys.apiKeyGrok || '',
                openai: existingKeys.apiKeyOpenAI || ''
            });
            
            // Auto-validate existence visually
            setTestStatuses({
                gemini: existingKeys.apiKeyGemini ? 'success' : 'idle',
                grok: existingKeys.apiKeyGrok ? 'success' : 'idle',
                openai: existingKeys.apiKeyOpenAI ? 'success' : 'idle'
            });
        }
    }, [existingKeys]);

    const handleInputChange = (val: string) => {
        setDraftKeys(prev => ({ ...prev, [activeProvider]: val }));
        setTestStatuses(prev => ({ ...prev, [activeProvider]: 'idle' }));
    };

    const handleTestKey = async () => {
        const key = draftKeys[activeProvider];
        if (!key.trim()) return;

        setTestStatuses(prev => ({ ...prev, [activeProvider]: 'testing' }));
        
        try {
            let success = false;
            if (activeProvider === 'gemini') {
                success = await testGeminiConnection(key);
            } else if (activeProvider === 'grok') {
                success = await testGrokConnection(key);
            } else {
                // OpenAI simple fetch test
                try {
                    const res = await fetch('https://api.openai.com/v1/models', {
                        headers: { 'Authorization': `Bearer ${key}` }
                    });
                    success = res.ok;
                } catch(e) { success = false; }
            }
            
            setTestStatuses(prev => ({ ...prev, [activeProvider]: success ? 'success' : 'error' }));
        } catch (e) {
            setTestStatuses(prev => ({ ...prev, [activeProvider]: 'error' }));
        }
    };

    const handleSave = async () => {
        // Validation: Must have at least one Main Key (Gemini or Grok)
        const hasMainKey = draftKeys.gemini.trim() || draftKeys.grok.trim();
        if (!hasMainKey) {
            alert("You must provide at least one Main API Key (Gemini or Grok) to proceed.");
            return;
        }

        if (storageMode === 'encrypted') {
            if (!isSecure) {
                alert("Encryption is unavailable in this environment (HTTP). Please use Quick Session.");
                return;
            }
            if (pin.length < 4) {
                alert("PIN must be at least 4 digits.");
                return;
            }
            if (pin !== pinConfirm) {
                alert("PINs do not match.");
                return;
            }
        }

        setIsProcessing(true);
        try {
            // 1. Storage Logic
            if (storageMode === 'encrypted') {
                await requestPersistentStorage();
                
                const providers: Provider[] = ['gemini', 'grok', 'openai'];
                
                for (const p of providers) {
                    const key = draftKeys[p];
                    if (key.trim()) {
                        const encrypted = await encryptApiKey(key, pin);
                        await db.secrets.put({
                            id: p,
                            provider: p,
                            mode: 'encrypted',
                            enc: encrypted,
                            createdAt: Date.now(),
                            updatedAt: Date.now()
                        });
                    } else {
                        // Clean up empty keys
                        await db.secrets.delete(p);
                    }
                }
            } else {
                // Session Mode: Clear persistent secrets
                await db.secrets.clear();
            }

            // 2. Prepare Runtime Keys
            const finalKeys: Partial<AppSettings> = {
                apiKeyGemini: draftKeys.gemini,
                apiKeyGrok: draftKeys.grok,
                apiKeyOpenAI: draftKeys.openai,
            };

            // 3. Set Active Provider preference
            // If the user entered Gemini but not Grok, default to Gemini, and vice-versa.
            if (draftKeys.gemini && !draftKeys.grok) finalKeys.activeProvider = 'gemini';
            else if (!draftKeys.gemini && draftKeys.grok) finalKeys.activeProvider = 'grok';
            // If both present, preserve existing setting or default to Gemini if unset.
            
            onKeysReady(finalKeys);
            if (onClose) onClose();

        } catch (e: any) {
            console.error("Save Failed", e);
            alert(`Failed to secure keys: ${e.message}`);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleUnlock = async () => {
        if (!pin.trim()) return;
        setIsProcessing(true);
        setUnlockError('');
        
        try {
            const secrets = await db.secrets.toArray();
            const decryptedKeys: Partial<AppSettings> = {};
            let successCount = 0;

            for (const secret of secrets) {
                if (secret.mode === 'encrypted' && secret.enc) {
                    try {
                        const rawKey = await decryptApiKey(secret.enc, pin);
                        if (rawKey) {
                            if (secret.id === 'gemini') decryptedKeys.apiKeyGemini = rawKey;
                            if (secret.id === 'grok') decryptedKeys.apiKeyGrok = rawKey;
                            if (secret.id === 'openai') decryptedKeys.apiKeyOpenAI = rawKey;
                            successCount++;
                        }
                    } catch (e) {
                        // Wrong PIN usually throws here
                        console.warn(`Decrypt failed for ${secret.id}`);
                    }
                }
            }

            // If we decrypted ANYTHING, we let them in.
            // This handles cases where one key might be corrupt but another is fine.
            if (successCount > 0) {
                onKeysReady(decryptedKeys);
                if (onClose) onClose();
            } else {
                setUnlockError("Incorrect PIN or no keys found.");
            }
        } catch (e: any) {
            console.error("Unlock critical failure", e);
            setUnlockError("Storage Access Error: " + e.message);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleClearKeys = async () => {
        if (confirm("Reset Secure Storage? This deletes all saved keys from this device.")) {
            await db.secrets.clear();
            window.location.reload();
        }
    };

    const getPlaceholder = (p: Provider) => {
        if (p === 'gemini') return 'AIzaSy...';
        if (p === 'grok') return 'xai-...';
        return 'sk-...';
    };

    // --- RENDER: UNLOCK MODE ---
    if (mode === 'unlock') {
        return (
            <div className="fixed inset-0 z-[200] bg-cerberus-900 flex items-center justify-center p-4">
                <div className="w-full max-w-md bg-black/50 border border-cerberus-800 rounded-lg p-8 text-center animate-fadeIn shadow-2xl">
                    <Lock size={48} className="mx-auto text-cerberus-accent mb-4" />
                    <h2 className="text-xl font-serif text-white mb-2 tracking-widest">SECURE STORAGE LOCKED</h2>
                    <p className="text-gray-500 text-xs font-mono mb-6">Enter your PIN to decrypt API keys.</p>
                    
                    <input 
                        type="password" 
                        value={pin}
                        onChange={e => setPin(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleUnlock()}
                        className="bg-cerberus-900 border border-cerberus-700 rounded p-3 text-center text-white text-lg tracking-[0.5em] w-full mb-4 focus:border-cerberus-accent outline-none font-mono placeholder-gray-700"
                        placeholder="••••"
                        autoFocus
                    />
                    
                    {unlockError && <div className="text-red-500 text-xs mb-4 flex items-center justify-center gap-2"><AlertCircle size={12}/> {unlockError}</div>}

                    <button 
                        onClick={handleUnlock}
                        disabled={isProcessing}
                        className="w-full py-3 bg-cerberus-600 hover:bg-cerberus-500 text-white font-bold uppercase tracking-widest rounded transition-colors flex items-center justify-center gap-2 mb-4"
                    >
                        {isProcessing ? <Loader2 size={16} className="animate-spin"/> : <Unlock size={16}/>}
                        Decrypt & Enter
                    </button>
                    
                    <button onClick={handleClearKeys} className="text-xs text-gray-600 hover:text-red-500 underline flex items-center justify-center gap-1 w-full">
                        <Trash2 size={12}/> Forgot PIN? Reset Storage
                    </button>
                </div>
            </div>
        );
    }

    // --- RENDER: SETUP/SETTINGS MODE ---
    const testStatus = testStatuses[activeProvider];
    const currentKey = draftKeys[activeProvider];

    return (
        <div className={`
            ${mode === 'settings' ? 'relative' : 'fixed inset-0 z-[200] bg-cerberus-900 flex items-center justify-center p-4'}
        `}>
            <div className={`w-full ${mode === 'settings' ? '' : 'max-w-md bg-black/50 border border-cerberus-800 rounded-lg p-6 shadow-2xl animate-fadeIn'}`}>
                {mode !== 'settings' && (
                    <div className="text-center mb-6">
                        <Shield size={40} className="mx-auto text-cerberus-accent mb-2" />
                        <h2 className="text-lg font-serif text-white tracking-widest">SYSTEM CREDENTIALS</h2>
                        <p className="text-[10px] text-gray-500 uppercase tracking-wider">Configure your connection to the Void</p>
                    </div>
                )}

                <div className="space-y-5">
                    {/* Provider Select Tabs */}
                    <div>
                        <label className="block text-[10px] uppercase text-gray-500 font-bold mb-2">Select Provider</label>
                        <div className="flex bg-cerberus-900/50 p-1 rounded border border-cerberus-800">
                            {(['gemini', 'grok', 'openai'] as const).map(p => {
                                const status = testStatuses[p];
                                // Logic for dot: Red if error, Green if success, Gray if idle but has content
                                let dotColor = 'bg-transparent';
                                if (status === 'success') dotColor = 'bg-green-500 shadow-[0_0_5px_#22c55e]';
                                else if (status === 'error') dotColor = 'bg-red-500 shadow-[0_0_5px_#ef4444]';
                                else if (draftKeys[p]) dotColor = 'bg-gray-500';

                                return (
                                    <button
                                        key={p}
                                        onClick={() => setActiveProvider(p)}
                                        className={`flex-1 py-2 text-[10px] uppercase font-bold rounded transition-all duration-200 flex items-center justify-center gap-1 ${
                                            activeProvider === p 
                                                ? 'bg-cerberus-800 text-white shadow shadow-black/50 border border-cerberus-700' 
                                                : 'text-gray-500 hover:text-gray-300'
                                        }`}
                                    >
                                        {p === 'openai' ? 'OpenAI' : p === 'grok' ? 'xAI Grok' : 'Gemini'}
                                        {/* Status Dot */}
                                        <span className={`w-1.5 h-1.5 rounded-full ml-1 ${dotColor}`} />
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* API Key Input Field */}
                    <div className="relative">
                        <label className="flex justify-between text-[10px] uppercase text-gray-500 font-bold mb-1">
                            <span>{activeProvider} API Key</span>
                            {activeProvider === 'openai' && <span className="text-gray-600">(Optional - Voice/Image)</span>}
                        </label>
                        <div className="relative group">
                            <input 
                                type={showKey ? "text" : "password"}
                                value={currentKey}
                                onChange={e => handleInputChange(e.target.value)}
                                className={`
                                    w-full bg-cerberus-900 border rounded p-3 text-sm text-white font-mono pr-24 outline-none transition-all duration-300
                                    ${testStatus === 'success' 
                                        ? 'border-green-800 shadow-[0_0_10px_rgba(34,197,94,0.1)] focus:border-green-600' 
                                        : testStatus === 'error' 
                                            ? 'border-red-800 focus:border-red-600' 
                                            : 'border-cerberus-700 focus:border-cerberus-accent'
                                    }
                                `}
                                placeholder={getPlaceholder(activeProvider)}
                            />
                            
                            {/* Toggle Visibility */}
                            <button 
                                onClick={() => setShowKey(!showKey)}
                                className="absolute right-24 top-3 text-gray-500 hover:text-gray-300"
                            >
                                {showKey ? <EyeOff size={14}/> : <Eye size={14}/>}
                            </button>

                            {/* Test Button - BLUE DEFAULT */}
                            <button 
                                onClick={handleTestKey}
                                disabled={!currentKey || testStatus === 'testing'}
                                className={`
                                    absolute right-1 top-1 bottom-1 px-3 rounded text-[10px] uppercase font-bold flex items-center gap-2 transition-all duration-300
                                    ${testStatus === 'success' 
                                        ? 'bg-green-700 text-white shadow-[0_0_10px_rgba(34,197,94,0.4)]' 
                                        : testStatus === 'error'
                                            ? 'bg-red-700 text-white'
                                            : 'bg-blue-600 hover:bg-blue-500 text-white' // BLUE DEFAULT
                                    }
                                    ${(!currentKey || testStatus === 'testing') && 'opacity-70 cursor-not-allowed'}
                                `}
                            >
                                {testStatus === 'testing' ? <Loader2 size={12} className="animate-spin"/> : 
                                 testStatus === 'success' ? <Check size={12}/> : 
                                 testStatus === 'error' ? <AlertCircle size={12}/> :
                                 <RefreshCw size={12}/>}
                                
                                {testStatus === 'success' ? 'Locked' : testStatus === 'error' ? 'Retry' : 'Test'}
                            </button>
                        </div>
                        {testStatus === 'success' && <p className="text-[9px] text-green-500 mt-1 flex items-center gap-1"><Check size={10}/> Key verified & locked in.</p>}
                    </div>

                    <div className="h-px bg-cerberus-800 w-full" />

                    {/* Storage Mode */}
                    <div>
                        <label className="block text-[10px] uppercase text-gray-500 font-bold mb-2">Storage Persistence</label>
                        <div className="grid grid-cols-2 gap-3">
                            <button 
                                onClick={() => setStorageMode('session')}
                                className={`p-3 border rounded text-left transition-all ${storageMode === 'session' ? 'bg-cerberus-800 border-cerberus-accent shadow-[0_0_10px_rgba(212,175,55,0.1)]' : 'bg-transparent border-cerberus-800 opacity-60 hover:opacity-100'}`}
                            >
                                <div className="text-xs font-bold text-white mb-1 flex items-center gap-2"><Zap size={12}/> Quick Session</div>
                                <div className="text-[9px] text-gray-400 leading-tight">Key cleared on reload. Safe for shared devices.</div>
                            </button>
                            <button 
                                onClick={() => {
                                    if (isSecure) setStorageMode('encrypted');
                                    else alert("Secure Storage requires HTTPS or Localhost.");
                                }}
                                className={`p-3 border rounded text-left transition-all ${storageMode === 'encrypted' ? 'bg-cerberus-800 border-cerberus-accent shadow-[0_0_10px_rgba(212,175,55,0.1)]' : 'bg-transparent border-cerberus-800 opacity-60 hover:opacity-100'} ${!isSecure && 'opacity-30 cursor-not-allowed grayscale'}`}
                            >
                                <div className="text-xs font-bold text-white mb-1 flex items-center gap-2"><Lock size={12}/> Secure Storage</div>
                                <div className="text-[9px] text-gray-400 leading-tight">Encrypted with PIN. Persists locally.</div>
                            </button>
                        </div>
                    </div>

                    {/* PIN Entry (Only if Encrypted) */}
                    {storageMode === 'encrypted' && (
                        <div className="animate-fadeIn bg-cerberus-900/50 p-4 rounded border border-cerberus-800">
                            <label className="block text-[10px] uppercase text-cerberus-accent font-bold mb-2">Set Security PIN</label>
                            <div className="flex gap-2">
                                <input 
                                    type="password" 
                                    value={pin}
                                    onChange={e => setPin(e.target.value)}
                                    className="flex-1 bg-black border border-cerberus-700 rounded p-2 text-center text-white font-mono tracking-widest text-sm focus:border-cerberus-accent outline-none"
                                    placeholder="PIN"
                                    maxLength={8}
                                />
                                <input 
                                    type="password" 
                                    value={pinConfirm}
                                    onChange={e => setPinConfirm(e.target.value)}
                                    className="flex-1 bg-black border border-cerberus-700 rounded p-2 text-center text-white font-mono tracking-widest text-sm focus:border-cerberus-accent outline-none"
                                    placeholder="Confirm"
                                    maxLength={8}
                                />
                            </div>
                            <p className="text-[9px] text-gray-500 mt-2">PIN is required to decrypt keys on next visit. If lost, data is unrecoverable.</p>
                        </div>
                    )}

                    {/* Footer Actions */}
                    <div className="pt-2 flex gap-2">
                        {onClose && (
                            <button onClick={onClose} className="flex-1 py-3 border border-cerberus-700 text-gray-400 rounded uppercase text-xs font-bold hover:text-white hover:border-gray-500 transition-colors">
                                Cancel
                            </button>
                        )}
                        <button 
                            onClick={handleSave}
                            disabled={isProcessing || (!draftKeys.gemini && !draftKeys.grok)}
                            className={`flex-[2] py-3 text-white rounded uppercase text-xs font-bold flex items-center justify-center gap-2 shadow-lg transition-all
                                ${isProcessing || (!draftKeys.gemini && !draftKeys.grok) 
                                    ? 'bg-gray-800 text-gray-500 cursor-not-allowed' 
                                    : 'bg-cerberus-600 hover:bg-cerberus-500 hover:shadow-[0_0_15px_rgba(155,44,44,0.4)]'
                                }
                            `}
                        >
                            {isProcessing ? <Loader2 size={16} className="animate-spin"/> : <Save size={16}/>}
                            {mode === 'onboarding' ? 'Initialize System' : 'Save Configuration'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default KeyManager;
