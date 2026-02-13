export interface Guild {
  id: string;
  name: string;
  owner_id: string;
  irc_namespace_prefix: string;
  created_at: string;
}

export interface CreateGuildRequest {
  name: string;
}
