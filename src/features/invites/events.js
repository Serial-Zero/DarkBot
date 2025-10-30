import { Events } from 'discord.js';
import { ensureInviteTable, recordInviteJoin } from './repository.js';

let readinessLogged = false;
let inviteCache = new Map();

function logReadinessDisabled() {
  if (readinessLogged) {
    return;
  }

  readinessLogged = true;
  console.warn(
    '[Invites] Skipping invite tracking setup. Configure DB_* environment variables to enable it.',
  );
}

async function fetchInviteUses(guild) {
  const invites = await guild.invites.fetch().catch(() => null);
  if (!invites) {
    return null;
  }

  const usesMap = new Map();
  for (const [code, invite] of invites) {
    usesMap.set(code, {
      uses: invite.uses ?? 0,
      inviterId: invite.inviter?.id ?? null,
    });
  }
  return usesMap;
}

async function findInviter(guild, newMember) {
  const currentInvites = await fetchInviteUses(guild);
  if (!currentInvites) {
    return null;
  }

  const cachedInvites = inviteCache.get(guild.id);
  if (!cachedInvites) {
    inviteCache.set(guild.id, currentInvites);
    return null;
  }

  for (const [code, current] of currentInvites.entries()) {
    const cached = cachedInvites.get(code);
    
    if (!cached) {
      if (current.uses > 0 && current.inviterId) {
        inviteCache.set(guild.id, currentInvites);
        return current.inviterId;
      }
      continue;
    }

    if (current.uses > cached.uses && current.inviterId) {
      inviteCache.set(guild.id, currentInvites);
      return current.inviterId;
    }
  }

  inviteCache.set(guild.id, currentInvites);
  return null;
}

export const inviteEvents = [
  {
    event: Events.ClientReady,
    once: true,
    async execute(client) {
      const ready = await ensureInviteTable();

      if (ready) {
        console.log('[Invites] Invite tracking table is ready.');

        for (const guild of client.guilds.cache.values()) {
          const invites = await fetchInviteUses(guild);
          if (invites) {
            inviteCache.set(guild.id, invites);
          }
        }
      } else {
        logReadinessDisabled();
      }
    },
  },
  {
    event: Events.GuildCreate,
    once: false,
    async execute(guild) {
      const invites = await fetchInviteUses(guild);
      if (invites) {
        inviteCache.set(guild.id, invites);
      }
    },
  },
  {
    event: Events.GuildMemberAdd,
    once: false,
    async execute(member) {
      if (!member.guild) {
        return;
      }

      if (member.user.bot) {
        return;
      }

      const inviterId = await findInviter(member.guild, member);

      if (!inviterId) {
        return;
      }

      const result = await recordInviteJoin(
        member.guild.id,
        inviterId,
        member.user.id,
      );

      if (!result) {
        logReadinessDisabled();
      }
    },
  },
];

