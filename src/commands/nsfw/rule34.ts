import {
  AutocompleteInteraction,
  ChatInputCommandInteraction,
  EmbedBuilder,
  SlashCommandBuilder,
} from 'discord.js';
import type { CommandModule } from '../types';

interface Rule34Post {
  id: number;
  file_url?: string;
  sample_url?: string;
  preview_url?: string;
  rating?: string;
  score?: number;
  tags?: string;
  owner?: string;
  source?: string;
}

interface Rule34ErrorResponse {
  success: 'false' | false;
  message?: string;
}

interface Rule34AutocompleteEntry {
  label: string;
  value: string;
}

const RULE34_API_BASE_URL = 'https://api.rule34.xxx/index.php';
const RULE34_AUTOCOMPLETE_URL = 'https://api.rule34.xxx/autocomplete.php';
const RULE34_USER_ID = process.env.R34_USER_ID ?? process.env.RULE34_USER_ID ?? '';
const RULE34_API_KEY = process.env.R34_API_KEY ?? process.env.RULE34_API_KEY ?? '';

function sanitizeTags(rawTags: string[]): string[] {
  const seen = new Set<string>();

  return rawTags
    .map((tag) => tag.trim().toLowerCase())
    .map((tag) => tag.replace(/\s*\([^)]*\)\s*$/, ''))
    .map((tag) => tag.replace(/\s+/g, '_'))
    .map((tag) => tag.replace(/[^a-z0-9:_-]/g, '_'))
    .map((tag) => tag.replace(/_{2,}/g, '_'))
    .map((tag) => tag.replace(/^_+|_+$/g, ''))
    .filter((tag) => {
      if (tag.length === 0 || seen.has(tag)) {
        return false;
      }
      seen.add(tag);
      return true;
    });
}

async function fetchRule34Posts(tags: string[], limit = 50): Promise<Rule34Post[]> {
  const params = new URLSearchParams({
    page: 'dapi',
    s: 'post',
    q: 'index',
    json: '1',
    limit: limit.toString(),
    tags: tags.join(' '),
  });

  if (RULE34_USER_ID && RULE34_API_KEY) {
    params.set('user_id', RULE34_USER_ID);
    params.set('api_key', RULE34_API_KEY);
  }

  const response = await fetch(`${RULE34_API_BASE_URL}?${params.toString()}`, {
    headers: {
      'User-Agent': 'DarkBot (Discord Bot)',
    },
  });

  if (!response.ok) {
    throw new Error(`Rule34 API returned status ${response.status}`);
  }

  const rawPayload = await response.text();

  if (!rawPayload.trim()) {
    return [];
  }

  let payload: Rule34Post[] | Rule34ErrorResponse;

  try {
    payload = JSON.parse(rawPayload) as Rule34Post[] | Rule34ErrorResponse;
  } catch (parseError) {
    const messageSnippet = rawPayload.slice(0, 200);
    throw new Error(`Rule34 API returned malformed JSON. Payload snippet: ${messageSnippet}`);
  }

  if (Array.isArray(payload)) {
    return payload;
  }

  if (payload && typeof payload === 'object' && 'success' in payload && payload.success === 'false') {
    throw new Error(payload.message ?? 'Rule34 API reported search failure.');
  }

  throw new Error('Unexpected Rule34 API response format.');
}

function pickRandomPost(posts: Rule34Post[]): Rule34Post | null {
  if (posts.length === 0) {
    return null;
  }

  const index = Math.floor(Math.random() * posts.length);
  return posts[index] ?? null;
}

function createPostEmbed(post: Rule34Post, tags: string[]): EmbedBuilder {
  const imageUrl = post.file_url ?? post.sample_url ?? post.preview_url ?? null;
  const ratingLabel = post.rating ? post.rating.toUpperCase() : 'UNKNOWN';
  const postUrl = `https://rule34.xxx/index.php?page=post&s=view&id=${post.id}`;

  const embed = new EmbedBuilder()
    .setTitle('Rule34 Result')
    .setURL(postUrl)
    .setDescription(`Tags: ${tags.map((tag) => `\`${tag}\``).join(' ')}`)
    .setFooter({
      text: `Rating: ${ratingLabel}${typeof post.score === 'number' ? ` • Score: ${post.score}` : ''}`,
    });

  if (imageUrl) {
    embed.setImage(imageUrl);
  }

  if (post.source) {
    embed.addFields({ name: 'Source', value: post.source, inline: false });
  }

  if (post.tags) {
    const condensedTags = post.tags
      .split(' ')
      .filter(Boolean)
      .slice(0, 25)
      .join(', ');

    if (condensedTags.length > 0) {
      embed.addFields({ name: 'Post Tags', value: condensedTags, inline: false });
    }
  }

  return embed;
}

const data = new SlashCommandBuilder()
  .setName('r34')
  .setDescription('Fetch a random Rule34 post with the provided tags.')
  .setNSFW(true)
  .addStringOption((option) =>
    option
      .setName('tag1')
      .setDescription('Required tag used for the search.')
      .setRequired(true)
      .setAutocomplete(true)
  )
  .addStringOption((option) =>
    option.setName('tag2').setDescription('Optional additional tag.').setAutocomplete(true)
  )
  .addStringOption((option) =>
    option.setName('tag3').setDescription('Optional additional tag.').setAutocomplete(true)
  )
  .addStringOption((option) =>
    option.setName('tag4').setDescription('Optional additional tag.').setAutocomplete(true)
  )
  .addStringOption((option) =>
    option.setName('tag5').setDescription('Optional additional tag.').setAutocomplete(true)
  );

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const rawTags = [
    interaction.options.getString('tag1', true),
    interaction.options.getString('tag2') ?? '',
    interaction.options.getString('tag3') ?? '',
    interaction.options.getString('tag4') ?? '',
    interaction.options.getString('tag5') ?? '',
  ];

  const tags = sanitizeTags(rawTags);

  if (tags.length === 0) {
    await interaction.reply({
      content: 'Please provide at least one valid tag for the search.',
      ephemeral: true,
    });
    return;
  }

  await interaction.deferReply();

  try {
    const posts = await fetchRule34Posts(tags);

    if (!posts || posts.length === 0) {
      await interaction.editReply({
        content: 'No results found for the provided tags.',
      });
      return;
    }

    const post = pickRandomPost(posts);

    if (!post) {
      await interaction.editReply({
        content: 'Failed to choose a result from the Rule34 API response.',
      });
      return;
    }

    const embed = createPostEmbed(post, tags);

    await interaction.editReply({
      embeds: [embed],
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred.';
    await interaction.editReply({
      content: `Failed to fetch Rule34 content: ${errorMessage}`,
    });
  }
}

async function autocomplete(interaction: AutocompleteInteraction): Promise<void> {
  const focused = interaction.options.getFocused(true);
  const query = focused.value.trim().toLowerCase();

  if (!query) {
    await interaction.respond([]);
    return;
  }

  const encodedQuery = encodeURIComponent(query);

  try {
    const response = await fetch(`${RULE34_AUTOCOMPLETE_URL}?q=${encodedQuery}`, {
      headers: {
        'User-Agent': 'DarkBot (Discord Bot)',
      },
    });

    if (!response.ok) {
      throw new Error(`Autocomplete endpoint returned status ${response.status}`);
    }

    const suggestions = (await response.json()) as Rule34AutocompleteEntry[];

    if (!Array.isArray(suggestions)) {
      throw new Error('Unexpected autocomplete payload.');
    }

    const choices = suggestions.slice(0, 25).map((entry) => ({
      name: entry.label,
      value: entry.value.toLowerCase(),
    }));

    await interaction.respond(choices);
  } catch (error) {
    console.error('Rule34 autocomplete failed:', error);
    if (!interaction.responded) {
      await interaction.respond([]);
    }
  }
}

export const rule34Command: CommandModule = {
  data,
  requiresNSFW: true,
  execute,
  autocomplete,
};
