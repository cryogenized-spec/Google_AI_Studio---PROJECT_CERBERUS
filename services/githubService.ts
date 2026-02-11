import { ChatState, Outfit, Room } from "../types";

// Helper to base64 encode utf-8 strings properly
function utf8_to_b64(str: string) {
    return window.btoa(unescape(encodeURIComponent(str)));
}

export const fetchRepositories = async (token: string): Promise<string[]> => {
    try {
        const response = await fetch('https://api.github.com/user/repos?sort=updated&per_page=100', {
            headers: {
                'Authorization': `token ${token}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });

        if (!response.ok) {
            throw new Error('Failed to fetch repositories');
        }

        const data = await response.json();
        return data.map((repo: any) => repo.full_name); // Returns "owner/repo"
    } catch (error) {
        console.error("GitHub Repo Fetch Error:", error);
        throw error;
    }
};

export const uploadFile = async (
    token: string,
    owner: string,
    repo: string,
    path: string,
    content: string,
    message: string
) => {
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
    
    // 1. Get SHA if file exists (to update)
    let sha: string | undefined = undefined;
    try {
        const checkRes = await fetch(url, {
            headers: {
                'Authorization': `token ${token}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });
        if (checkRes.ok) {
            const data = await checkRes.json();
            sha = data.sha;
        }
    } catch (e) {
        // File likely doesn't exist, proceed
    }

    // 2. Upload
    const body: any = {
        message,
        content: utf8_to_b64(content),
    };
    if (sha) body.sha = sha;

    const response = await fetch(url, {
        method: 'PUT',
        headers: {
            'Authorization': `token ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body)
    });

    if (!response.ok) {
        throw new Error(`Failed to upload ${path}`);
    }
};

const generateManifestJSONC = (outfits: Outfit[], rooms: Room[]) => {
    let output = `/**
 * PROJECT CERBERUS: MANIFEST
 * This file contains visual references (URLS) for the application state.
 * It is generated automatically during backup.
 */

{
  // --- WARDROBE MANIFEST ---
  // Urls pointing to visual representations of Ysaraith's attire.
  "wardrobe": [
`;

    outfits.forEach((o, i) => {
        const isLast = i === outfits.length - 1;
        output += `    {
      "id": "${o.id}",
      "name": "${o.name}",
      // ${o.description.replace(/\n/g, ' ')}
      "url": "${o.imageUrl}",
      "origin": "${o.origin}"
    }${isLast ? '' : ','}\n`;
    });

    output += `  ],

  // --- LOCATION MANIFEST ---
  // Background environments for the chat interface.
  "locations": [
`;

    rooms.forEach((r, i) => {
        const isLast = i === rooms.length - 1;
        output += `    {
      "id": "${r.id}",
      "name": "${r.name}",
      // Context: ${r.description}
      "url": "${r.backgroundImage}"
    }${isLast ? '' : ','}\n`;
    });

    output += `  ]
}`;

    return output;
};

export const performBackup = async (
    token: string, 
    repoFullName: string, 
    state: ChatState
) => {
    if (!token || !repoFullName) throw new Error("Missing GitHub credentials");
    
    const [owner, repo] = repoFullName.split('/');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const basePath = 'backups';

    // 1. Backup Full State (JSON)
    const stateContent = JSON.stringify(state, null, 2);
    await uploadFile(token, owner, repo, `${basePath}/cerberus_state.json`, stateContent, `Backup State: ${timestamp}`);

    // 2. Backup Manifest (JSONC - Human Readable URLs)
    const manifestContent = generateManifestJSONC(state.outfits, state.rooms);
    await uploadFile(token, owner, repo, `${basePath}/manifest.jsonc`, manifestContent, `Update Manifest: ${timestamp}`);

    return true;
};

export const restoreBackup = async (
    token: string,
    repoFullName: string
): Promise<ChatState> => {
    if (!token || !repoFullName) throw new Error("Missing GitHub credentials");
    const [owner, repo] = repoFullName.split('/');
    const path = 'backups/cerberus_state.json';
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;

    const response = await fetch(url, {
        headers: {
            'Authorization': `token ${token}`,
            'Accept': 'application/vnd.github.v3.raw' // Raw format gets content directly
        }
    });

    if (!response.ok) {
        throw new Error('Failed to fetch backup file');
    }

    const data = await response.json();
    return data as ChatState;
};