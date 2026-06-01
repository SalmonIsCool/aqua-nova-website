export interface DiscordWidgetMember {
  id: string;
  username: string;
  discriminator: string;
  avatar: string | null;
  status: string;
  avatar_url: string;
}

export interface DiscordWidgetChannel {
  id: string;
  name: string;
  position: number;
}

export interface DiscordWidgetData {
  id: string;
  name: string;
  instant_invite: string;
  channels: DiscordWidgetChannel[];
  members: DiscordWidgetMember[];
  presence_count: number;
}
