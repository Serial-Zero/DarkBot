import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  ContainerBuilder,
  MessageFlags,
  SlashCommandBuilder,
  TextDisplayBuilder,
} from 'discord.js';

/**
 * @typedef {import('discord.js').AutocompleteInteraction} AutocompleteInteraction
 * @typedef {import('discord.js').ChatInputCommandInteraction} ChatInputCommandInteraction
 * @typedef {import('../types.js').CommandModule} CommandModule
 */

/**
 * @typedef {Object} Rule34Post
 * @property {number} id
 * @property {string} [file_url]
 * @property {string} [sample_url]
 * @property {string} [preview_url]
 * @property {string} [rating]
 * @property {number} [score]
 * @property {string} [tags]
 * @property {string} [owner]
 * @property {string} [source]
 */

/**
 * @typedef {Object} Rule34ErrorResponse
 * @property {'false' | false} success
 * @property {string} [message]
 */

/**
 * @typedef {Object} Rule34AutocompleteEntry
 * @property {string} label
 * @property {string} value
 */

const RULE34_API_BASE_URL = 'https://api.rule34.xxx/index.php';
const RULE34_AUTOCOMPLETE_URL = 'https://api.rule34.xxx/autocomplete.php';
const RULE34_USER_AGENT = 'DarkBot (Discord Bot)';
const MAX_AUTOCOMPLETE_CHOICES = 25;
const DEFAULT_POST_LIMIT = 50;
const BTN_PREFIX = 'r34';
const TIMEOUT_MS = 2 * 60 * 1000;

let credentialsLogged = false;

/**
 * @returns {{ apiKey: string; userId: string; login: string }}
 */
function resolveCredentials() {
  const credentials = {
    apiKey: process.env.R34_API_KEY ?? process.env.RULE34_API_KEY ?? '',
    userId: process.env.R34_USER_ID ?? process.env.RULE34_USER_ID ?? '',
    login:
      process.env.R34_LOGIN ??
      process.env.R34_USERNAME ??
      process.env.RULE34_LOGIN ??
      process.env.RULE34_USERNAME ??
      '',
  };

  if (!credentialsLogged) {
    credentialsLogged = true;
    console.info('[Rule34] Credential summary', summarizeCredentials(credentials));
  }

  return credentials;
}

/**
 * @param {{ apiKey: string; userId: string; login: string }} credentials
 * @returns {{ apiKey: string; userId: string; login: string }}
 */
function summarizeCredentials({ apiKey, userId, login }) {
  return {
    apiKey: apiKey ? `${apiKey.length} chars` : 'missing',
    userId: userId ? 'present' : 'missing',
    login: login ? 'present' : 'missing',
  };
}

/**
 * @param {string[]} rawTags
 * @returns {string[]}
 */
function sanitizeTags(rawTags) {
  const seen = new Set();

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

/**
 * @param {string} url
 * @param {RequestInit} [options]
 * @returns {Promise<Response>}
 */
function fetchWithRule34Headers(url, options = {}) {
  const headers = new Headers(options.headers ?? {});
  headers.set('User-Agent', RULE34_USER_AGENT);

  return fetch(url, { ...options, headers });
}

/**
 * @param {string[]} tags
 * @param {number} limit
 * @param {{ apiKey: string; userId: string; login: string }} credentials
 * @returns {URLSearchParams}
 */
function buildPostSearchParams(tags, limit, { apiKey, userId, login }) {
  const params = new URLSearchParams({
    page: 'dapi',
    s: 'post',
    q: 'index',
    json: '1',
    limit: limit.toString(),
    tags: tags.join(' '),
  });

  if (apiKey) {
    if (login) {
      params.set('login', login);
    }

    if (userId) {
      params.set('user_id', userId);
    }

    params.set('api_key', apiKey);
  }

  return params;
}

/**
 * @param {URLSearchParams} params
 * @returns {Record<string, string>}
 */
function summarizeParamsForLog(params) {
  return Object.fromEntries(
    Array.from(params.entries()).map(([key, value]) => {
      if (key === 'api_key') {
        return [key, `${value.slice(0, 6)}…`];
      }
      return [key, value];
    }),
  );
}

/**
 * @param {string} rawPayload
 * @returns {Rule34Post[]}
 */
function parseRule34PostPayload(rawPayload) {
  if (!rawPayload.trim()) {
    return [];
  }

  /** @type {Rule34Post[] | Rule34ErrorResponse | { post?: Rule34Post | Rule34Post[]; posts?: Rule34Post[] } | string | null} */
  let payload;

  try {
    payload = JSON.parse(rawPayload);
  } catch (parseError) {
    const messageSnippet = rawPayload.slice(0, 200);
    throw new Error(`Rule34 API returned malformed JSON. Payload snippet: ${messageSnippet}`);
  }

  if (Array.isArray(payload)) {
    return payload;
  }

  if (typeof payload === 'string') {
    throw new Error(payload);
  }

  if (payload && typeof payload === 'object' && 'success' in payload && payload.success === 'false') {
    throw new Error(payload.message ?? 'Rule34 API reported search failure.');
  }

  if (payload && typeof payload === 'object') {
    if (Array.isArray(payload.posts)) {
      return payload.posts;
    }

    if (Array.isArray(payload.post)) {
      return payload.post;
    }

    if (payload.post && typeof payload.post === 'object') {
      return [payload.post];
    }
  }

  throw new Error('Unexpected Rule34 API response format.');
}

/**
 * @param {unknown} entry
 * @returns {entry is Rule34AutocompleteEntry}
 */
function isValidAutocompleteEntry(entry) {
  return (
    Boolean(entry) &&
    typeof entry === 'object' &&
    typeof /** @type {Record<string, unknown>} */ (entry).label === 'string' &&
    typeof /** @type {Record<string, unknown>} */ (entry).value === 'string'
  );
}

/**
 * @param {string[]} tags
 * @param {number} [limit=DEFAULT_POST_LIMIT]
 * @returns {Promise<Rule34Post[]>}
 */
async function fetchRule34Posts(tags, limit = DEFAULT_POST_LIMIT) {
  const credentials = resolveCredentials();
  const params = buildPostSearchParams(tags, limit, credentials);

  console.info('[Rule34] Requesting posts with params', summarizeParamsForLog(params));

  const response = await fetchWithRule34Headers(`${RULE34_API_BASE_URL}?${params.toString()}`);

  if (!response.ok) {
    throw new Error(`Rule34 API returned status ${response.status}`);
  }

  const rawPayload = await response.text();

  return parseRule34PostPayload(rawPayload);
}

/**
 * @param {Rule34Post[]} posts
 * @returns {Rule34Post | null}
 */
function pickRandomPost(posts) {
  if (posts.length === 0) {
    return null;
  }

  const index = Math.floor(Math.random() * posts.length);
  return posts[index] ?? null;
}

/**
 * @param {Rule34Post} post
 * @param {string[]} tags
 * @returns {EmbedBuilder}
 */
function createPostComponents(post, tags) {
  const imageUrl = post.file_url ?? post.sample_url ?? post.preview_url ?? null;
  const ratingLabel = post.rating ? post.rating.toUpperCase() : 'UNKNOWN';

  const lines = [
    '## Rule34 Result',
    '',
    `**Tags:** ${tags.map((t) => `\`${t}\``).join(' ')}`,
    `**Rating:** ${ratingLabel}${typeof post.score === 'number' ? ` • **Score:** ${post.score}` : ''}`,
  ];

  if (post.source) {
    lines.push(`**Source:** ${post.source}`);
  }

  if (imageUrl) {
    lines.push('', imageUrl);
  }

  return new ContainerBuilder().addTextDisplayComponents(
    new TextDisplayBuilder().setContent(lines.join('\n')),
  );
}

function buildButtonRow(postUrl, sessionId, disabled = false) {
  const newBtn = new ButtonBuilder()
    .setCustomId(`${BTN_PREFIX}:${sessionId}:new`)
    .setLabel('New Image')
    .setStyle(ButtonStyle.Primary)
    .setDisabled(disabled);

  const linkBtn = new ButtonBuilder()
    .setLabel('View Post')
    .setStyle(ButtonStyle.Link)
    .setURL(postUrl);

  return new ActionRowBuilder().addComponents(newBtn, linkBtn);
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

/**
 * @param {ChatInputCommandInteraction} interaction
 */
async function execute(interaction) {
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

    let post = pickRandomPost(posts);

    if (!post) {
      await interaction.editReply({
        content: 'Failed to choose a result from the Rule34 API response.',
      });
      return;
    }

    const sessionId = interaction.id;
    const postUrl = `https://rule34.xxx/index.php?page=post&s=view&id=${post.id}`;
    const container = createPostComponents(post, tags);

    const msg = await interaction.editReply({
      flags: MessageFlags.IsComponentsV2,
      components: [container, buildButtonRow(postUrl, sessionId)],
    });

    const collector = msg.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: TIMEOUT_MS,
    });

    collector.on('collect', async (btn) => {
      if (btn.user.id !== interaction.user.id) {
        await btn.reply({ content: 'Only the command user can use these buttons.', ephemeral: true });
        return;
      }

      const parts = btn.customId.split(':');
      if (parts.length !== 3 || parts[0] !== BTN_PREFIX || parts[1] !== sessionId) {
        await btn.deferUpdate();
        return;
      }

      if (parts[2] === 'new') {
        post = pickRandomPost(posts);
        if (!post) {
          await btn.reply({ content: 'No more posts available.', ephemeral: true });
          return;
        }
        const newUrl = `https://rule34.xxx/index.php?page=post&s=view&id=${post.id}`;
        const newContainer = createPostComponents(post, tags);
        await btn.update({
          components: [newContainer, buildButtonRow(newUrl, sessionId)],
        });
      }
    });

    collector.on('end', async () => {
      const finalUrl = `https://rule34.xxx/index.php?page=post&s=view&id=${post.id}`;
      const finalContainer = createPostComponents(post, tags);
      try {
        await msg.edit({ components: [finalContainer, buildButtonRow(finalUrl, sessionId, true)] });
      } catch {}
    });
  } catch (error) {
    let errorMessage = error instanceof Error ? error.message : 'Unknown error occurred.';

    if (/missing authentication/i.test(errorMessage)) {
      errorMessage =
        'Authentication failed. Ensure R34_API_KEY and R34_USER_ID come from the same Rule34 account ' +
        'and are configured on the hosting environment (login is optional but recommended).';
    }

    await interaction.editReply({
      content: `Failed to fetch Rule34 content: ${errorMessage}`,
    });
  }
}

/**
 * @param {AutocompleteInteraction} interaction
 */
async function autocomplete(interaction) {
  const focused = interaction.options.getFocused(true);
  const query = focused.value.trim().toLowerCase();

  if (!query) {
    await interaction.respond([]);
    return;
  }

  const encodedQuery = encodeURIComponent(query);

  try {
    const response = await fetchWithRule34Headers(`${RULE34_AUTOCOMPLETE_URL}?q=${encodedQuery}`);

    if (!response.ok) {
      throw new Error(`Autocomplete endpoint returned status ${response.status}`);
    }

    /** @type {unknown} */
    const suggestions = await response.json();

    if (!Array.isArray(suggestions)) {
      throw new Error('Unexpected autocomplete payload.');
    }

    const choices = suggestions
      .filter(isValidAutocompleteEntry)
      .slice(0, MAX_AUTOCOMPLETE_CHOICES)
      .map((entry) => ({
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

/** @type {CommandModule} */
export const rule34Command = {
  data,
  requiresNSFW: true,
  execute,
  autocomplete,
};
