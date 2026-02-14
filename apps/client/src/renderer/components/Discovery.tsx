import { Search, Compass, Users, Sparkles, ChevronRight, Check } from 'lucide-react';
import React, { useState, useEffect } from 'react';
import { useGuildStore } from '../store/guild.store';
import type { Guild } from '@ironcord/shared/types';

export const Discovery: React.FC = () => {
    const [guilds, setGuilds] = useState<Guild[]>([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [joiningId, setJoiningId] = useState<string | null>(null);

    const myGuilds = useGuildStore((state) => state.guilds);
    const myGuildIds = new Set(myGuilds.map(g => g.id));

    const fetchDiscovery = async (query?: string) => {
        setLoading(true);
        try {
            const results = await window.ironcord.getDiscoveryGuilds(query);
            setGuilds(results);
        } catch (err) {
            console.error('Failed to fetch discovery guilds:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDiscovery();
    }, []);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        fetchDiscovery(search);
    };

    const handleJoin = async (guildId: string) => {
        setJoiningId(guildId);
        try {
            const joinedGuild = await window.ironcord.joinDiscoveryGuild(guildId);

            // Update store
            const currentGuilds = useGuildStore.getState().guilds;
            useGuildStore.getState().setGuilds([...currentGuilds, joinedGuild]);

            // Select the joined guild
            useGuildStore.getState().setCurrentGuild(joinedGuild.id);
            useGuildStore.getState().setCurrentView('chat');

            // Fetch channels
            const channels = await window.ironcord.getChannels(joinedGuild.id);
            useGuildStore.getState().setChannels(joinedGuild.id, channels);

            // Select the first channel (usually general)
            const firstChannel = channels[0];
            if (firstChannel) {
                useGuildStore.getState().setCurrentChannel(firstChannel.id);
            }

        } catch (err) {
            console.error('Failed to join guild:', err);
        } finally {
            setJoiningId(null);
        }
    };

    return (
        <div className="flex-1 overflow-y-auto bg-[#313338] relative flex flex-col animate-in fade-in duration-500">
            {/* Hero Section */}
            <div className="relative h-64 w-full flex-shrink-0 bg-indigo-600 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 via-purple-600 to-indigo-800" />
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-20" />
                <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center z-10">
                    <h1 className="text-4xl font-extrabold text-white mb-2 drop-shadow-lg flex items-center gap-3">
                        <Sparkles className="text-yellow-400" size={32} />
                        Find your community on IronCord
                    </h1>
                    <p className="text-indigo-100 text-lg mb-8 max-w-2xl font-medium">
                        From gaming to study groups, there's a place for everyone.
                    </p>

                    <form onSubmit={handleSearch} className="w-full max-w-xl relative group">
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Explore communities..."
                            className="w-full h-12 rounded-lg bg-gray-900/80 backdrop-blur-md px-12 text-white border-0 focus:ring-2 focus:ring-white/50 transition-all outline-none shadow-2xl placeholder:text-gray-400"
                        />
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-white transition-colors" size={20} />
                        <button
                            type="submit"
                            className="absolute right-2 top-1/2 -translate-y-1/2 h-8 px-4 rounded bg-indigo-500 text-white text-xs font-bold hover:bg-indigo-400 transition-colors"
                        >
                            Search
                        </button>
                    </form>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 p-8 max-w-7xl mx-auto w-full">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <Compass size={24} className="text-indigo-400" />
                        Featured Communities
                    </h2>
                    <div className="text-sm text-gray-400">
                        {guilds.length} communities discovered
                    </div>
                </div>

                {loading ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                            <div key={i} className="h-72 rounded-xl bg-gray-800/50 animate-pulse border border-white/5" />
                        ))}
                    </div>
                ) : guilds.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                        <div className="w-24 h-24 rounded-full bg-gray-800 flex items-center justify-center mb-4">
                            <Compass size={48} className="text-gray-600" />
                        </div>
                        <h3 className="text-xl font-bold text-white mb-1">No communities found</h3>
                        <p className="text-gray-400">Try searching for something else or check back later.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {guilds.map((guild) => {
                            const isMember = myGuildIds.has(guild.id);

                            return (
                                <div
                                    key={guild.id}
                                    className="flex flex-col rounded-xl bg-[#2b2d31] border border-white/5 overflow-hidden hover:shadow-2xl hover:shadow-indigo-500/10 transition-all hover:-translate-y-1 group"
                                >
                                    <div className="h-32 w-full relative overflow-hidden bg-gray-800">
                                        {guild.banner_url ? (
                                            <img src={guild.banner_url} alt={guild.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                                        ) : (
                                            <div className="w-full h-full bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center">
                                                <Compass className="text-white/10" size={48} />
                                            </div>
                                        )}
                                        <div className="absolute top-2 right-2 px-2 py-1 rounded bg-black/50 backdrop-blur-sm text-[10px] font-bold text-white uppercase tracking-wider border border-white/10">
                                            Public
                                        </div>
                                    </div>

                                    <div className="p-4 flex-1 flex flex-col">
                                        <h3 className="text-lg font-bold text-white mb-1 truncate group-hover:text-indigo-400 transition-colors">
                                            {guild.name}
                                        </h3>
                                        <p className="text-sm text-gray-400 line-clamp-2 mb-4 flex-1 h-10">
                                            {guild.description || 'Welcome to our community! Join us for chats, events, and more.'}
                                        </p>

                                        <div className="flex items-center gap-4 text-xs font-bold text-gray-500 mb-4">
                                            <div className="flex items-center gap-1">
                                                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                                                <span>Online</span>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <Users size={14} />
                                                <span>Members</span>
                                            </div>
                                        </div>

                                        <button
                                            onClick={() => !isMember && handleJoin(guild.id)}
                                            disabled={isMember || joiningId === guild.id}
                                            className={`w-full h-10 rounded-lg flex items-center justify-center gap-2 font-bold transition-all ${isMember
                                                ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                                                : 'bg-[#b5bac1] text-gray-900 hover:bg-white active:scale-95'
                                                }`}
                                        >
                                            {joiningId === guild.id ? (
                                                <div className="w-4 h-4 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
                                            ) : isMember ? (
                                                <>
                                                    <Check size={18} />
                                                    <span>Joined</span>
                                                </>
                                            ) : (
                                                <>
                                                    <span>Join Guild</span>
                                                    <ChevronRight size={16} />
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};
