import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useGuildStore } from '../store/guild.store';

interface CreateChannelModalProps {
    isOpen: boolean;
    onClose: () => void;
    guildId: string;
}

export const CreateChannelModal: React.FC<CreateChannelModalProps> = ({ isOpen, onClose, guildId }) => {
    const [newChannelName, setNewChannelName] = useState('');
    const createChannel = useGuildStore((state) => state.createChannel);

    if (!isOpen) return null;

    const handleCreateChannel = async (e: React.FormEvent) => {
        e.preventDefault();
        if (guildId && newChannelName.trim()) {
            try {
                await createChannel(guildId, newChannelName.trim());
                setNewChannelName('');
                onClose();
            } catch (err) {
                console.error('Failed to create channel:', err);
            }
        }
    };

    const modalContent = (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
            <div className="absolute inset-0" onClick={onClose} />
            <div className="relative w-80 rounded-xl bg-gray-900 border border-white/10 p-6 shadow-2xl z-10 scale-in-center animate-in duration-200">
                <h3 className="text-xl font-bold text-white mb-4">Create Channel</h3>
                <form onSubmit={handleCreateChannel}>
                    <div className="mb-4">
                        <label className="block text-xs font-bold uppercase text-gray-500 mb-2 tracking-wider">Channel Name</label>
                        <input
                            autoFocus
                            type="text"
                            value={newChannelName}
                            onChange={e => setNewChannelName(e.target.value)}
                            className="w-full bg-black/30 text-white border border-white/10 rounded-lg p-3 outline-none focus:border-indigo-500 transition-all placeholder-gray-600"
                            placeholder="e.g. general"
                        />
                    </div>
                    <div className="flex justify-end space-x-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-white/5 transition-all"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={!newChannelName.trim()}
                            className="px-6 py-2 rounded-lg bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-600/20 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Create
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );

    const modalRoot = document.getElementById('modal-root');
    if (!modalRoot) return null;

    return createPortal(modalContent, modalRoot);
};
