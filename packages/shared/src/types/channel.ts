export interface Channel {
  id: string;
  guild_id: string;
  name: string;
  irc_channel_name: string;
  topic?: string;
  created_at: string;
}

export interface CreateChannelRequest {
  name: string;
  topic?: string;
}
