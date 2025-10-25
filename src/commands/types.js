/**
 * @typedef {(
 *   import('discord.js').SlashCommandBuilder |
 *   import('discord.js').SlashCommandSubcommandsOnlyBuilder |
 *   import('discord.js').SlashCommandOptionsOnlyBuilder
 * )} SlashCommandData
 */

/**
 * @typedef {Object} CommandModule
 * @property {SlashCommandData} data
 * @property {boolean} [requiresNSFW]
 * @property {(interaction: import('discord.js').ChatInputCommandInteraction) => Promise<void>} execute
 * @property {(interaction: import('discord.js').AutocompleteInteraction) => Promise<void>} [autocomplete]
 */

export {};
