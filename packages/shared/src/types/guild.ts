export interface Guild {
  id: string;
  name: string;
  owner_id: string;
  irc_namespace_prefix: string;
  description?: string;
  banner_url?: string;
  created_at: string;
}

export interface CreateGuildRequest {
  name: string;
  description?: string;
  banner_url?: string;
}
