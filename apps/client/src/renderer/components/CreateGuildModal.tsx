import { X, Camera, ChevronRight, Gamepad2, School, Palette, Users, Plus } from 'lucide-react';
import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useGuildStore } from '../store/guild.store';

interface CreateGuildModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type Step = 'templates' | 'customize';

export const CreateGuildModal: React.FC<CreateGuildModalProps> = ({ isOpen, onClose }) => {
  const [step, setStep] = useState<Step>('templates');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [bannerUrl, setBannerUrl] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [iconUrl, setIconUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const guilds = useGuildStore((state) => state.guilds);
  const setGuilds = useGuildStore((state) => state.setGuilds);
  const setCurrentGuild = useGuildStore((state) => state.setCurrentGuild);

  const guildsList = Array.isArray(guilds) ? guilds : [];

  if (!isOpen) return null;

  const reset = () => {
    setStep('templates');
    setName('');
    setDescription('');
    setBannerUrl('');
    setError('');
    setLoading(false);
  };

  const handleClose = () => {
    reset();
    setIconUrl(null);
    onClose();
  };

  const handleSelectTemplate = (templateName: string) => {
    setName(`${templateName} Server`);
    setStep('customize');
  };

  const handleIconClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setIconUrl(url);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setError('');
    setLoading(true);

    try {
      const guild = await window.ironcord.createGuild({
        name: name.trim(),
        description: description.trim(),
        banner_url: bannerUrl.trim()
      });
      setGuilds([...guildsList, guild]);
      setCurrentGuild(guild.id);

      // Auto-fetch channels for the new guild and select general
      const channels = await window.ironcord.getChannels(guild.id);
      useGuildStore.getState().setChannels(guild.id, channels);
      const generalChannel = channels.find((c: any) => c.name === 'general');
      if (generalChannel) {
        useGuildStore.getState().setCurrentChannel(generalChannel.id);
      }

      handleClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create server';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const modalContent = (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-[480px] rounded-2xl bg-[#313338] border border-white/5 shadow-2xl overflow-hidden">
        <div className="p-4 flex justify-end absolute top-0 right-0 z-10">
          <button onClick={handleClose} className="text-gray-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="px-8 pt-8 pb-10">
          {step === 'templates' ? (
            <div className="animate-in slide-in-from-right-4 duration-300">
              <h2 className="text-2xl font-bold text-white text-center mb-2">Create your Guild</h2>
              <p className="text-gray-400 text-center text-sm mb-8 px-4">
                Start from a template to quickly set up your community or start from scratch.
              </p>

              <div className="space-y-6">
                <div>
                  <h3 className="text-xs font-bold uppercase text-gray-500 mb-3 tracking-wider">Start from a template</h3>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { id: 'gaming', name: 'Gaming', icon: <Gamepad2 className="text-purple-400" size={24} />, color: 'bg-purple-400/10' },
                      { id: 'study', name: 'Study Group', icon: <School className="text-emerald-400" size={24} />, color: 'bg-emerald-400/10' },
                      { id: 'artist', name: 'Artist Community', icon: <Palette className="text-blue-400" size={24} />, color: 'bg-blue-400/10' },
                      { id: 'local', name: 'Local Community', icon: <Users className="text-orange-400" size={24} />, color: 'bg-orange-400/10' },
                    ].map((t) => (
                      <button
                        key={t.id}
                        onClick={() => handleSelectTemplate(t.name)}
                        className="flex flex-col items-center justify-center p-4 rounded-xl border border-white/5 bg-[#2b2d31] hover:bg-[#35373c] transition-all group"
                      >
                        <div className={`w-12 h-12 rounded-full ${t.color} flex items-center justify-center mb-2 group-hover:scale-110 transition-transform`}>
                          {t.icon}
                        </div>
                        <span className="text-xs font-bold text-gray-300">{t.name}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-xs font-bold uppercase text-gray-500 mb-3 tracking-wider">Or start from scratch</h3>
                  <button
                    onClick={() => {
                      setName('');
                      setStep('customize');
                    }}
                    className="w-full flex items-center p-3 rounded-xl border border-white/5 bg-[#2b2d31] hover:bg-[#35373c] transition-all group"
                  >
                    <div className="w-10 h-10 rounded-full bg-indigo-500 flex items-center justify-center mr-4 group-hover:scale-110 transition-transform">
                      <Plus className="text-white" size={24} />
                    </div>
                    <span className="text-sm font-bold text-white flex-1 text-left">Create My Own</span>
                    <ChevronRight size={18} className="text-gray-500" />
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="animate-in slide-in-from-right-4 duration-300 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
              <h2 className="text-2xl font-bold text-white text-center mb-2">Customize your guild</h2>
              <p className="text-gray-400 text-center text-sm mb-6 px-4">
                Give your new guild a personality with a name and a description.
              </p>

              {error && (
                <div className="mb-4 rounded-lg bg-red-500/10 p-3 text-xs text-red-500 border border-red-500/20">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit}>
                <div className="flex justify-center mb-6">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept="image/*"
                    className="hidden"
                  />
                  <div className="relative group cursor-pointer" onClick={handleIconClick}>
                    <div className="w-20 h-20 rounded-full border-2 border-dashed border-gray-600 flex flex-col items-center justify-center text-gray-500 hover:border-indigo-500 hover:text-indigo-400 transition-all bg-[#2b2d31]/50 overflow-hidden">
                      {iconUrl ? (
                        <img src={iconUrl} alt="Server Icon" className="w-full h-full object-cover" />
                      ) : (
                        <>
                          <Camera size={28} className="mb-1" />
                          <span className="text-[10px] uppercase font-bold text-center px-2 leading-tight">Upload Icon</span>
                        </>
                      )}
                    </div>
                    <div className="absolute top-0 right-0 w-6 h-6 rounded-full bg-indigo-500 flex items-center justify-center border-4 border-[#313338] shadow-lg">
                      <Plus size={14} className="text-white" />
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label htmlFor="guild-name" className="block text-[10px] font-bold uppercase text-gray-400 mb-2 tracking-widest pl-1">Guild Name</label>
                    <input
                      id="guild-name"
                      autoFocus
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. The Iron Vanguard"
                      className="w-full h-10 rounded-md bg-[#1e1f22] p-3 text-sm text-white border-0 focus:ring-1 focus:ring-indigo-500 outline-none transition-all placeholder:text-gray-600"
                      required
                    />
                  </div>

                  <div>
                    <label htmlFor="guild-description" className="block text-[10px] font-bold uppercase text-gray-400 mb-2 tracking-widest pl-1">Description</label>
                    <textarea
                      id="guild-description"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="What is your community about?"
                      className="w-full h-20 rounded-md bg-[#1e1f22] p-3 text-sm text-white border-0 focus:ring-1 focus:ring-indigo-500 outline-none transition-all placeholder:text-gray-600 resize-none"
                    />
                  </div>

                  <div>
                    <label htmlFor="guild-banner" className="block text-[10px] font-bold uppercase text-gray-400 mb-2 tracking-widest pl-1">Banner URL</label>
                    <input
                      id="guild-banner"
                      type="text"
                      value={bannerUrl}
                      onChange={(e) => setBannerUrl(e.target.value)}
                      placeholder="https://example.com/banner.jpg"
                      className="w-full h-10 rounded-md bg-[#1e1f22] p-3 text-sm text-white border-0 focus:ring-1 focus:ring-indigo-500 outline-none transition-all placeholder:text-gray-600"
                    />
                  </div>

                  <div className="flex items-center justify-between pt-6">
                    <button
                      type="button"
                      onClick={() => setStep('templates')}
                      className="text-sm font-medium text-white hover:underline transition-colors px-2 py-2"
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      disabled={loading || !name.trim()}
                      className="h-10 rounded bg-[#5865f2] px-8 text-sm font-medium text-white transition-all hover:bg-[#4752c4] disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
                    >
                      {loading ? 'Creating...' : 'Create Guild'}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const modalRoot = document.getElementById('modal-root');
  if (!modalRoot) return null;

  return createPortal(modalContent, modalRoot);
};
