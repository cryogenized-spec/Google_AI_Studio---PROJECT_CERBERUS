
import React, { useState, useEffect } from 'react';
import { db, requestPersistentStorage } from '../services/organizerDb';
import { encryptApiKey, decryptApiKey } from '../services/encryptionService';
import { testGeminiConnection } from '../services/geminiService';
import { testGrokConnection } from '../services/grokService';
import { AppSettings, StoredSecret } from '../types';
import { Shield, Lock, Unlock, Key, Check, AlertCircle, Save, Loader2, RefreshCw } from 'lucide-react';

interface KeyManagerProps {
    mode: 'onboarding' | 'unlock' | 'settings';
    onKeysReady: (keys: Partial<AppSettings>) => void;
    onClose?: () => void;
    existingKeys?: Partial<AppSettings>;
}

const KeyManager: React.FC<KeyManagerProps> = ({ mode, onKeysReady, onClose, existingKeys }) => {
    const [step, setStep] = useState(mode === 'unlock' ? 'unlock' : 'input');
    const [provider, setProvider] = useState<'gemini' | 'grok' | 'openai'>('gemini');
    const [apiKey, setApiKey] = useState('');
    const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
    const [storageMode, setStorageMode] = useState<'session' | 'encrypted'>('session');
    const [pin, setPin] = useState('');
    const [pinConfirm, setPinConfirm] = useState('');
    const [unlockError, setUnlockError] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (existingKeys?.apiKeyGemini) {
            setProvider('gemini');
            setApiKey(existingKeys.apiKeyGemini);
        } else if (existingKeys?.apiKeyGrok) {
            setProvider('grok');
            setApiKey(existingKeys.apiKeyGrok);
        }
    }, [existingKeys]);

    const handleTestKey = async () => {
        if (!apiKey.trim()) return;
        setTestStatus('testing');
        try {
            let success = false;
            if (provider === 'gemini') {
                success = await testGeminiConnection(apiKey);
            } else if (provider === 'grok') {
                success = await testGrokConnection(apiKey);
            } else {
                success = true; // OpenAI test stub
            }
            
            if (success) setTestStatus('success');
            else setTestStatus('error');
        } catch (e) {
            setTestStatus('error');
        }
    };

    const handleSave = async () => {
        if (storageMode === 'encrypted') {
            if (pin.length < 4) {
                alert("PIN must be at least 4 digits.");
                return;
            }
            if (pin !== pinConfirm) {
                alert("PINs do not match.");
                return;
            }
        }

        setIsSaving(true);
        try {
            // 1. Persist storage if needed
            if (storageMode === 'encrypted') {
                await requestPersistentStorage();
                const encrypted = await encryptApiKey(apiKey, pin);
                
                await db.secrets.put({
                    id: provider,
                    provider: provider,
                    mode: 'encrypted',
                    enc: encrypted,
                    createdAt: Date.now(),
                    updatedAt: Date.now()
                });
            } else {
                // If switching to session, ensure we clear old secrets for this provider
                await db.secrets.delete(provider);
            }

            // 2. Prepare keys object
            const keys: Partial<AppSettings> = {};
            if (provider === 'gemini') keys.apiKeyGemini = apiKey;
            if (provider === 'grok') keys.apiKeyGrok = apiKey;
            if (provider === 'openai') keys.apiKeyOpenAI = apiKey;
            
            // Set active provider
            keys.activeProvider = provider === 'gemini' ? 'gemini' : 'grok';

            // 3. Callback
            onKeysReady(keys);
            if (onClose) onClose();

        } catch (e) {
            console.error("Save Failed", e);
            alert("Failed to secure key. Please try again.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleUnlock = async () => {
        if (!pin.trim()) return;
        setIsSaving(true);
        setUnlockError('');
        
        try {
            const secrets = await db.secrets.toArray();
            const decryptedKeys: Partial<AppSettings> = {};
            let hasSuccess = false;

            for (const secret of secrets) {
                if (secret.mode === 'encrypted' && secret.enc) {
                    try {
                        const rawKey = await decryptApiKey(secret.enc, pin);
                        if (secret.id === 'gemini') decryptedKeys.apiKeyGemini = rawKey;
                        if (secret.id === 'grok') decryptedKeys.apiKeyGrok = rawKey;
                        if (secret.id === 'openai') decryptedKeys.apiKeyOpenAI = rawKey;
                        hasSuccess = true;
                    } catch (e) {
                        // Wrong PIN likely
                    }
                }
            }

            if (hasSuccess) {
                onKeysReady(decryptedKeys);
                if (onClose) onClose();
            } else {
                setUnlockError("Incorrect PIN.");
            }
        } catch (e) {
            setUnlockError("Decryption error.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleClearKeys = async () => {
        if (confirm("Are you sure? This will delete all encrypted keys from this device.")) {
            await db.secrets.clear();
            window.location.reload();
        }
    };

    // --- RENDERERS ---

    if (step === 'unlock') {
        return (
            <div className="fixed inset-0 z-[200] bg-cerberus-900 flex items-center justify-center p-4">
                <div className="w-full max-w-md bg-black/50 border border-cerberus-800 rounded-lg p-8 text-center animate-fadeIn">
                    <Lock size={48} className="mx-auto text-cerberus-accent mb-4" />
                    <h2 className="text-xl font-serif text-white mb-2 tracking-widest">SECURE STORAGE LOCKED</h2>
                    <p className="text-gray-500 text-xs font-mono mb-6">Enter your PIN to decrypt API keys.</p>
                    
                    <input 
                        type="password" 
                        value={pin}
                        onChange={e => setPin(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleUnlock()}
                        className="bg-cerberus-900 border border-cerberus-700 rounded p-3 text-center text-white text-lg tracking-[0.5em] w-full mb-4 focus:border-cerberus-accent outline-none font-mono"
                        placeholder="••••"
                        autoFocus
                    />
                    
                    {unlockError && <div className="text-red-500 text-xs mb-4">{unlockError}</div>}

                    <button 
                        onClick={handleUnlock}
                        disabled={isSaving}
                        className="w-full py-3 bg-cerberus-600 hover:bg-cerberus-500 text-white font-bold uppercase tracking-widest rounded transition-colors flex items-center justify-center gap-2"
                    >
                        {isSaving ? <Loader2 size={16} className="animate-spin"/> : <Unlock size={16}/>}
                        Decrypt & Enter
                    </button>
                    
                    <button onClick={handleClearKeys} className="mt-4 text-xs text-gray-600 hover:text-red-500 underline">
                        Forgot PIN? Reset Storage
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className={`
            ${mode === 'settings' ? 'relative' : 'fixed inset-0 z-[200] bg-cerberus-900 flex items-center justify-center p-4'}
        `}>
            <div className={`w-full ${mode === 'settings' ? '' : 'max-w-md bg-black/50 border border-cerberus-800 rounded-lg p-6 shadow-2xl'}`}>
                {mode !== 'settings' && (
                    <div className="text-center mb-6">
                        <Shield size={40} className="mx-auto text-cerberus-accent mb-2" />
                        <h2 className="text-lg font-serif text-white tracking-widest">API KEY SETUP</h2>
                        <p className="text-xs text-gray-500">Your keys are never sent to our servers.</p>
                    </div>
                )}

                <div className="space-y-4">
                    {/* Provider Select */}
                    <div>
                        <label className="block text-[10px] uppercase text-gray-500 font-bold mb-1">Provider</label>
                        <div className="flex gap-2">
                            <button onClick={() => setProvider('gemini')} className={`flex-1 py-2 text-xs uppercase font-bold rounded border transition-colors ${provider === 'gemini' ? 'bg-cerberus-800 border-cerberus-accent text-white' : 'border-gray-800 text-gray-500'}`}>Google Gemini</button>
                            <button onClick={() => setProvider('grok')} className={`flex-1 py-2 text-xs uppercase font-bold rounded border transition-colors ${provider === 'grok' ? 'bg-cerberus-800 border-cerberus-accent text-white' : 'border-gray-800 text-gray-500'}`}>xAI Grok</button>
                            {/* OpenAI disabled for simplicity/focus unless requested, kept in UI for future */}
                        </div>
                    </div>

                    {/* Key Input */}
                    <div>
                        <label className="block text-[10px] uppercase text-gray-500 font-bold mb-1">API Key</label>
                        <div className="relative">
                            <input 
                                type="password" 
                                value={apiKey}
                                onChange={e => { setApiKey(e.target.value); setTestStatus('idle'); }}
                                className="w-full bg-cerberus-900 border border-cerberus-700 rounded p-2 text-sm text-white focus:border-cerberus-accent outline-none font-mono pr-20"
                                placeholder={`Enter ${provider} key...`}
                            />
                            <button 
                                onClick={handleTestKey}
                                disabled={!apiKey || testStatus === 'testing'}
                                className={`absolute right-1 top-1 bottom-1 px-3 rounded text-[10px] uppercase font-bold flex items-center gap-1 transition-colors ${testStatus === 'success' ? 'bg-green-900 text-green-400' : testStatus === 'error' ? 'bg-red-900 text-red-400' : 'bg-gray-800 text-gray-400 hover:text-white'}`}
                            >
                                {testStatus === 'testing' ? <Loader2 size={12} className="animate-spin"/> : testStatus === 'success' ? <Check size={12}/> : <RefreshCw size={12}/>}
                                {testStatus === 'success' ? 'Valid' : testStatus === 'error' ? 'Invalid' : 'Test'}
                            </button>
                        </div>
                    </div>

                    {/* Storage Mode */}
                    <div>
                        <label className="block text-[10px] uppercase text-gray-500 font-bold mb-2">Storage Method</label>
                        <div className="grid grid-cols-2 gap-3">
                            <button 
                                onClick={() => setStorageMode('session')}
                                className={`p-3 border rounded text-left transition-all ${storageMode === 'session' ? 'bg-cerberus-800 border-cerberus-accent' : 'bg-transparent border-gray-800 opacity-50 hover:opacity-100'}`}
                            >
                                <div className="text-xs font-bold text-white mb-1 flex items-center gap-2"><RefreshCw size={12}/> Session Only</div>
                                <div className="text-[9px] text-gray-400 leading-tight">Key cleared on reload. Recommended for shared devices.</div>
                            </button>
                            <button 
                                onClick={() => setStorageMode('encrypted')}
                                className={`p-3 border rounded text-left transition-all ${storageMode === 'encrypted' ? 'bg-cerberus-800 border-cerberus-accent' : 'bg-transparent border-gray-800 opacity-50 hover:opacity-100'}`}
                            >
                                <div className="text-xs font-bold text-white mb-1 flex items-center gap-2"><Lock size={12}/> Encrypted</div>
                                <div className="text-[9px] text-gray-400 leading-tight">Stored in DB encrypted with a PIN. Survives reload.</div>
                            </button>
                        </div>
                    </div>

                    {/* PIN Entry (Only if Encrypted) */}
                    {storageMode === 'encrypted' && (
                        <div className="animate-fadeIn bg-black/30 p-3 rounded border border-cerberus-800">
                            <label className="block text-[10px] uppercase text-cerberus-accent font-bold mb-2">Set Security PIN</label>
                            <div className="flex gap-2">
                                <input 
                                    type="password" 
                                    value={pin}
                                    onChange={e => setPin(e.target.value)}
                                    className="flex-1 bg-cerberus-900 border border-cerberus-700 rounded p-2 text-center text-white font-mono tracking-widest text-sm focus:border-cerberus-accent outline-none"
                                    placeholder="PIN"
                                    maxLength={8}
                                />
                                <input 
                                    type="password" 
                                    value={pinConfirm}
                                    onChange={e => setPinConfirm(e.target.value)}
                                    className="flex-1 bg-cerberus-900 border border-cerberus-700 rounded p-2 text-center text-white font-mono tracking-widest text-sm focus:border-cerberus-accent outline-none"
                                    placeholder="Confirm"
                                    maxLength={8}
                                />
                            </div>
                            <p className="text-[9px] text-gray-500 mt-2">PIN is used to derive encryption keys. If lost, data is unrecoverable.</p>
                        </div>
                    )}

                    <div className="pt-4 border-t border-cerberus-800 flex gap-2">
                        {onClose && (
                            <button onClick={onClose} className="flex-1 py-3 border border-gray-700 text-gray-400 rounded uppercase text-xs font-bold hover:text-white">
                                Cancel
                            </button>
                        )}
                        <button 
                            onClick={handleSave}
                            disabled={!apiKey || isSaving}
                            className="flex-[2] py-3 bg-cerberus-600 hover:bg-cerberus-500 text-white rounded uppercase text-xs font-bold flex items-center justify-center gap-2 shadow-lg"
                        >
                            {isSaving ? <Loader2 size={16} className="animate-spin"/> : <Save size={16}/>}
                            {mode === 'onboarding' ? 'Start Session' : 'Update Key'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default KeyManager;
