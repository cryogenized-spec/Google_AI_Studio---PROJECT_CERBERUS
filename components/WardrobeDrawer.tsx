import React, { useState } from 'react';
import { Outfit } from '../types';
import { Shirt, Plus, X, Save, ExternalLink, Check } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

interface WardrobeDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  outfits: Outfit[];
  currentOutfitId: string;
  onSelectOutfit: (id: string) => void;
  onUpdateOutfit: (outfit: Outfit) => void;
  onCreateOutfit: (outfit: Outfit) => void;
}

const WardrobeDrawer: React.FC<WardrobeDrawerProps> = ({
    isOpen, onClose, outfits, currentOutfitId, onSelectOutfit, onUpdateOutfit, onCreateOutfit
}) => {
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState<Partial<Outfit>>({});
    
    if (!isOpen) return null;

    const currentOutfit = outfits.find(o => o.id === currentOutfitId) || outfits[0];

    const handleEditStart = (outfit: Outfit) => {
        setEditingId(outfit.id);
        setEditForm({ ...outfit });
    };

    const handleEditSave = () => {
        if (editingId && editForm.name) {
            onUpdateOutfit({ 
                id: editingId,
                name: editForm.name || 'Unknown',
                description: editForm.description || '',
                imageUrl: editForm.imageUrl || '',
                wornImageUrl: editForm.wornImageUrl || '',
                origin: editForm.origin || 'User Edited'
             });
            setEditingId(null);
        }
    };

    const handleCreateNew = () => {
        const newOutfit: Outfit = {
            id: uuidv4(),
            name: 'New Ensemble',
            description: 'Describe the attire...',
            imageUrl: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?q=80&w=1000&auto=format&fit=crop',
            origin: 'User Created'
        };
        onCreateOutfit(newOutfit);
        setEditingId(newOutfit.id);
        setEditForm(newOutfit);
    };

    return (
        // Changed to h-[85dvh] and added overflow-hidden at top level
        <div className="fixed inset-x-0 bottom-0 z-[60] bg-cerberus-900 border-t border-cerberus-600 shadow-[0_-10px_40px_rgba(0,0,0,0.8)] flex flex-col transition-transform duration-300 h-[85dvh] md:h-[500px]">
            
            {/* Header */}
            <div className="flex shrink-0 justify-between items-center p-4 border-b border-cerberus-800 bg-cerberus-900">
                <div className="flex items-center gap-2 text-cerberus-accent">
                    <Shirt size={20} />
                    <span className="font-serif tracking-widest font-bold">WARDROBE MANIFEST</span>
                </div>
                <button onClick={onClose} className="text-gray-500 hover:text-white"><X size={20}/></button>
            </div>

            {/* Scrollable Content Area */}
            <div className="flex-1 flex flex-col md:flex-row overflow-y-auto overflow-x-hidden md:overflow-hidden">
                
                {/* ACTIVE SLOT (Left/Top) */}
                <div className="w-full md:w-1/3 p-4 md:p-6 border-b md:border-b-0 md:border-r border-cerberus-800 bg-black/20 flex flex-col items-center justify-center relative shrink-0">
                    <div className="absolute top-2 left-2 text-[10px] uppercase text-green-500 font-mono flex items-center gap-1 bg-green-900/20 px-2 py-1 rounded border border-green-900/50 z-10">
                        <Check size={10} /> Currently Wearing
                    </div>

                    {/* Image Preview - Shows WORN version if available, else standard */}
                    <div className="w-32 h-44 md:w-56 md:h-80 rounded-lg overflow-hidden border-2 border-cerberus-accent shadow-[0_0_20px_rgba(212,175,55,0.2)] mb-3 bg-cerberus-900 mt-6 md:mt-0 relative group">
                        <img src={currentOutfit.wornImageUrl || currentOutfit.imageUrl} alt={currentOutfit.name} className="w-full h-full object-cover" />
                        <div className="absolute bottom-0 inset-x-0 bg-black/70 text-[9px] text-center py-1 text-gray-400">
                            {currentOutfit.wornImageUrl ? "Portrait View" : "Item View"}
                        </div>
                    </div>

                    {/* Meta */}
                    <div className="text-center w-full">
                        <h2 className="text-lg md:text-xl font-serif text-white mb-1">{currentOutfit.name}</h2>
                        <div className="text-[10px] text-cerberus-accent mb-2 font-mono">
                            [{currentOutfit.origin}]
                        </div>
                        <p className="text-xs text-gray-400 italic line-clamp-3 px-2 md:px-4 max-w-sm mx-auto">{currentOutfit.description}</p>
                    </div>
                </div>

                {/* CAROUSEL & EDITING (Right/Bottom) */}
                <div className="flex-1 flex flex-col bg-cerberus-900/50 min-h-[300px]">
                    
                    {/* Horizontal Scroll Carousel */}
                    <div className="flex-1 overflow-x-auto p-4 md:p-6 flex gap-4 items-center custom-scrollbar bg-gradient-to-r from-black/40 via-transparent to-black/40 min-h-[250px]">
                         {/* Create New Card */}
                         <button 
                            onClick={handleCreateNew}
                            className="shrink-0 w-36 h-56 md:w-40 md:h-64 border-2 border-dashed border-cerberus-700 rounded-lg flex flex-col items-center justify-center text-gray-500 hover:text-cerberus-accent hover:border-cerberus-accent transition-all group bg-black/20"
                        >
                            <Plus size={32} className="mb-2 group-hover:scale-110 transition-transform" />
                            <span className="text-xs uppercase tracking-widest">Fabricate</span>
                         </button>

                         {outfits.map(outfit => (
                             <div 
                                key={outfit.id} 
                                className={`shrink-0 w-36 h-56 md:w-40 md:h-64 bg-black border rounded-lg overflow-hidden relative group transition-all duration-300 ${currentOutfitId === outfit.id ? 'border-cerberus-accent shadow-lg scale-105' : 'border-cerberus-800 opacity-70 hover:opacity-100 hover:scale-105'}`}
                             >
                                <img src={outfit.imageUrl} alt={outfit.name} className="w-full h-32 md:h-40 object-cover" />
                                <div className="p-2 md:p-3">
                                    <div className="font-serif text-sm text-gray-200 truncate">{outfit.name}</div>
                                    <div className="text-[9px] text-gray-500 truncate mb-2">[{outfit.origin}]</div>
                                    
                                    <div className="flex gap-2 mt-1">
                                        {currentOutfitId !== outfit.id && (
                                            <button 
                                                onClick={() => onSelectOutfit(outfit.id)}
                                                className="flex-1 bg-cerberus-800 hover:bg-cerberus-600 text-[10px] py-1.5 rounded text-white uppercase font-bold"
                                            >
                                                Wear
                                            </button>
                                        )}
                                        <button 
                                            onClick={() => handleEditStart(outfit)}
                                            className="flex-1 bg-gray-800 hover:bg-gray-700 text-[10px] py-1.5 rounded text-gray-300 uppercase border border-gray-700"
                                        >
                                            Edit
                                        </button>
                                    </div>
                                </div>
                             </div>
                         ))}
                    </div>

                    {/* Editor Panel (Slide up or overlay) */}
                    {editingId && (
                        <div className="shrink-0 border-t border-cerberus-700 bg-black/90 p-4 grid grid-cols-1 md:grid-cols-3 gap-4 animate-fadeIn shadow-2xl z-50">
                            <div className="space-y-2">
                                <label className="block text-[10px] font-mono text-cerberus-accent">NAME</label>
                                <input 
                                    value={editForm.name} 
                                    onChange={e => setEditForm({...editForm, name: e.target.value})}
                                    className="w-full bg-cerberus-900 border border-cerberus-700 rounded p-1.5 text-sm focus:border-cerberus-accent outline-none text-white"
                                />
                                <label className="block text-[10px] font-mono text-cerberus-accent">ORIGIN META</label>
                                <input 
                                    value={editForm.origin} 
                                    onChange={e => setEditForm({...editForm, origin: e.target.value})}
                                    className="w-full bg-cerberus-900 border border-cerberus-700 rounded p-1.5 text-xs focus:border-cerberus-accent outline-none text-gray-400"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="block text-[10px] font-mono text-cerberus-accent">ITEM IMAGE URL (The Clothes)</label>
                                <div className="flex gap-2">
                                    <input 
                                        value={editForm.imageUrl} 
                                        onChange={e => setEditForm({...editForm, imageUrl: e.target.value})}
                                        className="w-full bg-cerberus-900 border border-cerberus-700 rounded p-1.5 text-xs focus:border-cerberus-accent outline-none text-gray-400 font-mono truncate"
                                    />
                                    <a href={editForm.imageUrl} target="_blank" rel="noreferrer" className="p-1.5 bg-cerberus-800 rounded text-gray-400 hover:text-white shrink-0"><ExternalLink size={14}/></a>
                                </div>
                                <label className="block text-[10px] font-mono text-cerberus-accent">PORTRAIT URL (Worn by Model)</label>
                                <div className="flex gap-2">
                                    <input 
                                        value={editForm.wornImageUrl || ''} 
                                        onChange={e => setEditForm({...editForm, wornImageUrl: e.target.value})}
                                        className="w-full bg-cerberus-900 border border-cerberus-700 rounded p-1.5 text-xs focus:border-cerberus-accent outline-none text-gray-400 font-mono truncate"
                                        placeholder="Optional: URL of character wearing it"
                                    />
                                    {editForm.wornImageUrl && <a href={editForm.wornImageUrl} target="_blank" rel="noreferrer" className="p-1.5 bg-cerberus-800 rounded text-gray-400 hover:text-white shrink-0"><ExternalLink size={14}/></a>}
                                </div>
                            </div>
                            <div className="flex flex-col justify-between">
                                <div className="space-y-2">
                                    <label className="block text-[10px] font-mono text-cerberus-accent">DESCRIPTION</label>
                                    <textarea 
                                        value={editForm.description} 
                                        onChange={e => setEditForm({...editForm, description: e.target.value})}
                                        className="w-full h-16 bg-cerberus-900 border border-cerberus-700 rounded p-1.5 text-xs focus:border-cerberus-accent outline-none text-gray-300 resize-none"
                                    />
                                </div>
                                <div className="flex gap-2 mt-2">
                                    <button 
                                        onClick={handleEditSave}
                                        className="flex-1 bg-cerberus-600 hover:bg-cerberus-500 text-white py-2 rounded font-bold uppercase tracking-widest text-xs flex items-center justify-center gap-2"
                                    >
                                        <Save size={14} /> Save
                                    </button>
                                    <button 
                                        onClick={() => setEditingId(null)}
                                        className="flex-1 bg-transparent border border-gray-700 hover:border-gray-500 text-gray-400 py-2 rounded uppercase tracking-widest text-xs"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default WardrobeDrawer;