import { Events } from 'discord.js';

const MEMBER_ROLE_NAME = 'member';
const ASSIGN_REASON = 'Member role auto-sync';

/**
 * @param {import('discord.js').Guild} guild
 * @returns {Promise<import('discord.js').Role | null>}
 */
async function findMemberRole(guild) {
  await guild.roles.fetch();
  return (
    guild.roles.cache.find(
      (role) => role.name.toLowerCase() === MEMBER_ROLE_NAME,
    ) ?? null
  );
}

/**
 * @param {import('discord.js').GuildMember} member
 * @param {import('discord.js').Role} role
 * @returns {Promise<'assigned' | 'skipped' | 'failed'>}
 */
async function ensureMemberHasRole(member, role) {
  if (member.user.bot) {
    return 'skipped';
  }

  if (member.roles.cache.has(role.id)) {
    return 'skipped';
  }

  if (!member.manageable) {
    console.warn(
      `[MemberRole] Cannot manage ${member.id}; skipping Member role assignment.`,
    );
    return 'failed';
  }

  try {
    await member.roles.add(role, ASSIGN_REASON);
    return 'assigned';
  } catch (error) {
    console.error(
      `[MemberRole] Failed to add Member role to ${member.id}.`,
      error,
    );
    return 'failed';
  }
}

/**
 * @param {import('discord.js').Guild} guild
 * @returns {Promise<void>}
 */
async function syncGuildMembers(guild) {
  const memberRole = await findMemberRole(guild);

  if (!memberRole) {
    console.warn(
      `[MemberRole] No role named "Member" found in guild ${guild.id}; skipping sync.`,
    );
    return;
  }

  try {
    const members = await guild.members.fetch();
    let assigned = 0;
    let failed = 0;

    for (const member of members.values()) {
      const result = await ensureMemberHasRole(member, memberRole);

      if (result === 'assigned') {
        assigned += 1;
      } else if (result === 'failed') {
        failed += 1;
      }
    }

    if (assigned === 0 && failed === 0) {
      console.log(
        `[MemberRole] Everyone already has the Member role in guild ${guild.id}.`,
      );
    } else {
      console.log(
        `[MemberRole] Synced Member role in guild ${guild.id}. Assigned ${assigned}, failed ${failed}.`,
      );
    }
  } catch (error) {
    console.error(
      `[MemberRole] Failed to fetch members for guild ${guild.id}. Ensure the Guild Members intent is enabled.`,
      error,
    );
  }
}

export const memberRoleEvents = [
  {
    event: Events.ClientReady,
    once: false,
    /**
     * @param {import('discord.js').Client} client
     * @returns {Promise<void>}
     */
    async execute(client) {
      await client.guilds.fetch();

      for (const guild of client.guilds.cache.values()) {
        await syncGuildMembers(guild);
      }
    },
  },
  {
    event: Events.GuildMemberAdd,
    once: false,
    /**
     * @param {import('discord.js').GuildMember} member
     * @returns {Promise<void>}
     */
    async execute(member) {
      const memberRole = await findMemberRole(member.guild);

      if (!memberRole) {
        return;
      }

      await ensureMemberHasRole(member, memberRole);
    },
  },
];
