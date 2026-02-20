
import React, { useState, useEffect } from 'react';
import { Lock, Unlock, Key, Shield, AlertCircle, Save, X, Eye, EyeOff, Check, HardDrive } from 'lucide-react';
import { AppSettings } from '../types';
import { encryptApiKey, decryptApiKey } from '../services/encryptionService';
import { db } from '../services/organizerDb';

interface KeyManagerProps {
    mode: 'onboarding' | 'unlock' | 'settings';
    existingKeys?: Partial<AppSettings>;
    onKeysReady: (keys: Partial<AppSettings>) => void;
    onClose?: () => void;
}

const KeyManager: React.FC<KeyManagerProps> = ({ mode, existingKeys, onKeysReady, onClose }) => {
    // Key State
    const [keys, setKeys] = useState({
        apiKeyGemini: existingKeys?.apiKeyGemini || '',
        apiKeyGrok: existingKeys?.apiKeyGrok || '',
        apiKeyOpenAI: existingKeys?.apiKeyOpenAI || ''
    });

    // UI State
    const [storageMode, setStorageMode] = useState<'session' | 'encrypted' | 'plaintext'>('session');
    const [pin, setPin] = useState('');
    const [pinConfirm, setPinConfirm] = useState('');
    const [unlockPin, setUnlockPin] = useState('');
    const [status, setStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
    const [errorMsg, setErrorMsg] = useState('');
    const [showKeys, setShowKeys] = useState(false);

    // Initial check for settings mode to pre-fill storage mode
    useEffect(() => {
        if (mode === 'settings') {
            const checkDB = async () => {
                const secrets = await db.secrets.toArray();
                if (secrets.some(s => s.mode === 'encrypted')) {
                    setStorageMode('encrypted');
                } else if (secrets.some(s => s.mode === 'plaintext')) {
                    setStorageMode('plaintext');
                } else {
                    setStorageMode('session');
                }
            };
            checkDB();
        }
    }, [mode]);

    const handleUnlock = async () => {
        setStatus('processing');
        setErrorMsg('');
        try {
            const secrets = await db.secrets.toArray();
            
            // If nothing in DB but we are in unlock mode, just proceed with empty (fallback)
            if (secrets.length === 0) {
                onKeysReady({});
                return;
            }

            const decryptedKeys: Partial<AppSettings> = {};
            
            for (const secret of secrets) {
                if (secret.mode === 'encrypted' && secret.enc) {
                    try {
                        const val = await decryptApiKey(secret.enc, unlockPin);
                        if (secret.id === 'gemini') decryptedKeys.apiKeyGemini = val;
                        if (secret.id === 'grok') decryptedKeys.apiKeyGrok = val;
                        if (secret.id === 'openai') decryptedKeys.apiKeyOpenAI = val;
                    } catch (e) {
                        throw new Error("Invalid PIN");
                    }
                }
            }
            
            setStatus('success');
            setTimeout(() => onKeysReady(decryptedKeys), 500);
        } catch (e: any) {
            setStatus('error');
            setErrorMsg(e.message || "Decryption failed");
        }
    };

    const handleSave = async () => {
        if (storageMode === 'encrypted') {
            if (pin.length < 4) {
                setErrorMsg("PIN must be at least 4 digits.");
                return;
            }
            if (pin !== pinConfirm) {
                setErrorMsg("PINs do not match.");
                return;
            }
        }

        setStatus('processing');
        setErrorMsg('');
        
        try {
            // Clear existing secrets to prevent duplicates/conflicts
            await db.secrets.clear();

            const saveSecret = async (id: string, val: string) => {
                if (!val) return;
                
                if (storageMode === 'encrypted') {
                    const enc = await encryptApiKey(val, pin);
                    await db.secrets.put({
                        id,
                        provider: 'google', 
                        mode: 'encrypted',
                        enc,
                        createdAt: Date.now(),
                        updatedAt: Date.now()
                    });
                } else if (storageMode === 'plaintext') {
                    await db.secrets.put({
                        id,
                        provider: 'google',
                        mode: 'plaintext',
                        value: val,
                        createdAt: Date.now(),
                        updatedAt: Date.now()
                    });
                }
            };

            if (keys.apiKeyGemini) await saveSecret('gemini', keys.apiKeyGemini);
            if (keys.apiKeyGrok) await saveSecret('grok', keys.apiKeyGrok);
            if (keys.apiKeyOpenAI) await saveSecret('openai', keys.apiKeyOpenAI);

            // If session, we just cleared DB which is correct behavior (no persistence)

            setStatus('success');
            setTimeout(() => onKeysReady(keys), 500);
        } catch (e: any) {
            setStatus('error');
            setErrorMsg("Failed to save keys: " + e.message);
        }
    };

    // Render Unlock Screen
    if (mode === 'unlock') {
        return (
            <div className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-xl flex items-center justify-center p-4">
                <div className="bg-cerberus-900 border border-cerberus-700 w-full max-w-sm rounded-lg p-8 text-center shadow-[0_0_50px_rgba(212,175,55,0.1)] animate-fadeIn">
                    <Lock size={48} className="mx-auto text-cerberus-accent mb-4" />
                    <h2 className="text-xl font-serif text-white tracking-widest mb-2">SECURITY CHECK</h2>
                    <p className="text-xs text-gray-500 mb-6">Enter PIN to decrypt your credentials.</p>
                    
                    <input 
                        type="password"
                        autoFocus
                        value={unlockPin}
                        onChange={e => setUnlockPin(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleUnlock()}
                        className="bg-black border border-cerberus-800 text-center text-white text-2xl tracking-[0.5em] p-3 rounded w-full mb-4 focus:border-cerberus-accent focus:outline-none font-mono"
                        placeholder="••••"
                    />
                    
                    {errorMsg && <p className="text-red-500 text-xs mb-4 flex items-center justify-center gap-1"><AlertCircle size={12}/> {errorMsg}</p>}
                    
                    <button 
                        onClick={handleUnlock}
                        disabled={status === 'processing'}
                        className="w-full py-3 bg-cerberus-accent text-black font-bold uppercase tracking-widest text-xs rounded hover:bg-white transition-colors disabled:opacity-50"
                    >
                        {status === 'processing' ? 'Decrypting...' : 'Unlock'}
                    </button>
                </div>
            </div>
        );
    }

    // Render Setup/Settings Screen
    return (
        <div className={`fixed inset-0 z-[150] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 ${mode === 'settings' ? '' : 'animate-fadeIn'}`}>
            <div className="bg-cerberus-900 border border-cerberus-700 w-full max-w-lg rounded-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="p-4 border-b border-cerberus-800 flex justify-between items-center bg-cerberus-950">
                    <h2 className="text-lg font-serif text-cerberus-accent tracking-widest flex items-center gap-2">
                        <Key size={18} /> API CREDENTIALS
                    </h2>
                    {onClose && <button onClick={onClose}><X size={20} className="text-gray-500 hover:text-white" /></button>}
                </div>

                <div className="p-6 overflow-y-auto custom-scrollbar space-y-6">
                    {/* Intro Text */}
                    {mode === 'onboarding' && (
                        <div className="bg-cerberus-800/20 border border-cerberus-800 p-4 rounded text-center">
                            <p className="text-sm text-gray-300 font-serif leading-relaxed">
                                "I require a spark to awaken. Provide your API keys to instantiate the connection."
                            </p>
                        </div>
                    )}

                    {/* Inputs */}
                    <div className="space-y-4">
                        <div className="relative">
                            <label className="block text-[10px] font-mono text-cerberus-accent uppercase mb-1">Google Gemini API Key (Required)</label>
                            <input 
                                type={showKeys ? "text" : "password"} 
                                value={keys.apiKeyGemini}
                                onChange={e => setKeys({...keys, apiKeyGemini: e.target.value})}
                                className="w-full bg-black border border-cerberus-800 rounded p-3 text-sm text-white focus:border-cerberus-accent focus:outline-none font-mono"
                                placeholder="AIzaSy..."
                            />
                        </div>
                        <div className="relative">
                            <label className="block text-[10px] font-mono text-gray-500 uppercase mb-1">xAI Grok API Key (Optional)</label>
                            <input 
                                type={showKeys ? "text" : "password"} 
                                value={keys.apiKeyGrok}
                                onChange={e => setKeys({...keys, apiKeyGrok: e.target.value})}
                                className="w-full bg-black border border-cerberus-800 rounded p-3 text-sm text-white focus:border-cerberus-accent focus:outline-none font-mono"
                                placeholder="xai-..."
                            />
                        </div>
                        <div className="relative">
                            <label className="block text-[10px] font-mono text-gray-500 uppercase mb-1">OpenAI API Key (Optional / Voice)</label>
                            <input 
                                type={showKeys ? "text" : "password"} 
                                value={keys.apiKeyOpenAI}
                                onChange={e => setKeys({...keys, apiKeyOpenAI: e.target.value})}
                                className="w-full bg-black border border-cerberus-800 rounded p-3 text-sm text-white focus:border-cerberus-accent focus:outline-none font-mono"
                                placeholder="sk-..."
                            />
                        </div>
                        <button onClick={() => setShowKeys(!showKeys)} className="text-xs text-gray-500 flex items-center gap-1 hover:text-white">
                            {showKeys ? <EyeOff size={12}/> : <Eye size={12}/>} {showKeys ? 'Hide Keys' : 'Show Keys'}
                        </button>
                    </div>

                    {/* Storage Mode */}
                    <div className="border-t border-cerberus-800 pt-6">
                        <label className="block text-[10px] font-mono text-cerberus-accent uppercase mb-3 text-center">Storage Method</label>
                        <div className="flex bg-black p-1 rounded-lg border border-cerberus-800 mb-4 gap-1">
                            <button 
                                onClick={() => setStorageMode('session')}
                                className={`flex-1 py-3 rounded text-xs font-bold uppercase tracking-wider flex flex-col items-center gap-1 transition-all ${storageMode === 'session' ? 'bg-cerberus-800 text-white' : 'text-gray-500 hover:text-gray-300'}`}
                            >
                                <Unlock size={16} /> Session
                                <span className="text-[8px] opacity-60 normal-case font-sans">Wiped on reload</span>
                            </button>
                            <button 
                                onClick={() => setStorageMode('encrypted')}
                                className={`flex-1 py-3 rounded text-xs font-bold uppercase tracking-wider flex flex-col items-center gap-1 transition-all ${storageMode === 'encrypted' ? 'bg-cerberus-800 text-white' : 'text-gray-500 hover:text-gray-300'}`}
                            >
                                <Shield size={16} /> Encrypted
                                <span className="text-[8px] opacity-60 normal-case font-sans">Secure, PIN required</span>
                            </button>
                            <button 
                                onClick={() => setStorageMode('plaintext')}
                                className={`flex-1 py-3 rounded text-xs font-bold uppercase tracking-wider flex flex-col items-center gap-1 transition-all ${storageMode === 'plaintext' ? 'bg-cerberus-800 text-white' : 'text-gray-500 hover:text-gray-300'}`}
                            >
                                <HardDrive size={16} /> Local
                                <span className="text-[8px] opacity-60 normal-case font-sans">Unsecure, Auto-load</span>
                            </button>
                        </div>

                        {/* PIN Entry (Only if Encrypted) */}
                        {storageMode === 'encrypted' && (
                            <div className="animate-fadeIn bg-cerberus-900/50 p-4 rounded border border-cerberus-800 text-center">
                                <label className="block text-[10px] uppercase text-cerberus-accent font-bold mb-3 tracking-widest">Set Security PIN</label>
                                <div className="flex gap-3">
                                    <input 
                                        type="password" 
                                        value={pin}
                                        onChange={e => setPin(e.target.value)}
                                        className="flex-1 bg-black border border-cerberus-700 rounded p-3 text-center text-white font-mono tracking-widest text-sm focus:border-cerberus-accent outline-none placeholder-gray-600 transition-all"
                                        placeholder="PIN"
                                        maxLength={8}
                                    />
                                    <input 
                                        type="password" 
                                        value={pinConfirm}
                                        onChange={e => setPinConfirm(e.target.value)}
                                        className="flex-1 bg-black border border-cerberus-700 rounded p-3 text-center text-white font-mono tracking-widest text-sm focus:border-cerberus-accent outline-none placeholder-gray-600 transition-all"
                                        placeholder="CONFIRM"
                                        maxLength={8}
                                    />
                                </div>
                                <p className="text-[9px] text-gray-500 mt-3 mx-auto max-w-xs leading-relaxed">PIN is required to decrypt keys on next visit. If lost, data is unrecoverable.</p>
                            </div>
                        )}
                        
                        {storageMode === 'plaintext' && (
                            <div className="animate-fadeIn bg-red-950/20 p-3 rounded border border-red-900/50 text-center">
                                <p className="text-[10px] text-red-400 leading-relaxed font-bold flex items-center justify-center gap-2">
                                    <AlertCircle size={12}/> Warning: Keys stored in plaintext
                                </p>
                                <p className="text-[9px] text-gray-500 mt-1">Anyone with access to this device can retrieve your API keys.</p>
                            </div>
                        )}
                    </div>
                </div>

                <div className="p-4 border-t border-cerberus-800 bg-cerberus-950 flex flex-col gap-2">
                    {errorMsg && <div className="text-red-500 text-xs text-center flex items-center justify-center gap-2 bg-red-900/20 p-2 rounded"><AlertCircle size={14}/> {errorMsg}</div>}
                    <button 
                        onClick={handleSave}
                        disabled={status === 'processing'}
                        className={`w-full py-4 rounded font-bold uppercase tracking-widest text-xs flex items-center justify-center gap-2 transition-all ${status === 'success' ? 'bg-green-800 text-white' : 'bg-cerberus-accent text-black hover:bg-white'}`}
                    >
                        {status === 'processing' ? 'Processing...' : status === 'success' ? <><Check size={16}/> Saved</> : <><Save size={16}/> Save & Continue</>}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default KeyManager;
