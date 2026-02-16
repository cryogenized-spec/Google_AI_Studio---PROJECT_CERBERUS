
import { EncryptedData } from '../types';

// Convert utilities
const buf2hex = (buffer: ArrayBuffer) => {
    return Array.from(new Uint8Array(buffer)).map(x => x.toString(16).padStart(2, '0')).join('');
};

const hex2buf = (hexString: string) => {
    if (!hexString) return new Uint8Array(0);
    const match = hexString.match(/.{1,2}/g);
    if (!match) return new Uint8Array(0);
    return new Uint8Array(match.map(byte => parseInt(byte, 16)));
};

// PBKDF2 Constants
const PBKDF2_ITERATIONS = 100000;
const SALT_SIZE = 16;
const IV_SIZE = 12; // 96 bits for AES-GCM

export const generateKeyFromPin = async (pin: string, salt: Uint8Array): Promise<CryptoKey> => {
    const enc = new TextEncoder();
    const keyMaterial = await window.crypto.subtle.importKey(
        "raw",
        enc.encode(pin),
        { name: "PBKDF2" },
        false,
        ["deriveBits", "deriveKey"]
    );

    return await window.crypto.subtle.deriveKey(
        {
            name: "PBKDF2",
            salt: salt,
            iterations: PBKDF2_ITERATIONS,
            hash: "SHA-256"
        },
        keyMaterial,
        { name: "AES-GCM", length: 256 },
        false, // Not exportable
        ["encrypt", "decrypt"]
    );
};

export const encryptApiKey = async (apiKey: string, pin: string): Promise<EncryptedData> => {
    if (!window.isSecureContext) {
        throw new Error("Encryption requires a Secure Context (HTTPS or Localhost).");
    }

    const salt = window.crypto.getRandomValues(new Uint8Array(SALT_SIZE));
    const iv = window.crypto.getRandomValues(new Uint8Array(IV_SIZE));
    
    const key = await generateKeyFromPin(pin, salt);
    const enc = new TextEncoder();
    
    const ciphertext = await window.crypto.subtle.encrypt(
        {
            name: "AES-GCM",
            iv: iv
        },
        key,
        enc.encode(apiKey)
    );

    return {
        salt: buf2hex(salt),
        iv: buf2hex(iv),
        ciphertext: buf2hex(ciphertext),
        kdf: 'PBKDF2',
        iterations: PBKDF2_ITERATIONS,
        alg: 'AES-GCM'
    };
};

export const decryptApiKey = async (encrypted: EncryptedData, pin: string): Promise<string> => {
    try {
        if (!encrypted.salt || !encrypted.iv || !encrypted.ciphertext) {
            throw new Error("Corrupted key data.");
        }

        const salt = hex2buf(encrypted.salt);
        const iv = hex2buf(encrypted.iv);
        const ciphertext = hex2buf(encrypted.ciphertext);
        
        const key = await generateKeyFromPin(pin, salt);
        
        const decrypted = await window.crypto.subtle.decrypt(
            {
                name: "AES-GCM",
                iv: iv
            },
            key,
            ciphertext
        );
        
        const dec = new TextDecoder();
        return dec.decode(decrypted);
    } catch (e) {
        console.error("Decryption Failed", e);
        // Do not throw generic error here, let the caller handle the failure
        throw new Error("Invalid PIN");
    }
};
