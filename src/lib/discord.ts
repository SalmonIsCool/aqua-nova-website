import type { DiscordWidgetData } from "../types/discord-widget";

export function getDiscordWidgetApiUrl(guildId: string) {
  return `https://discord.com/api/guilds/${guildId}/widget.json`;
}

export async function fetchDiscordWidget(guildId: string): Promise<DiscordWidgetData | null> {
  try {
    const response = await fetch(getDiscordWidgetApiUrl(guildId), {
      headers: { Accept: "application/json" }
    });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as DiscordWidgetData;
  } catch {
    return null;
  }
}
