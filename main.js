require("dotenv").config();

const { Client: ClientClass, GatewayIntentBits } = require("discord.js");

const NewItemPing = "<@&1555656321813061794>";
const NewGamePing = "<@&1555656524884611112>";
const NewLimitedPing = "<@&1555634098372870195>";
const UptimePing = "<@&1555634154354515968>";
const DowntimePing = "<@&1555645752586412062>";

/*
const NewLimitedPing = "<@1370426338007060656>";
const UptimePing = "<@1370426338007060656>";
const DowntimePing = "<@1370426338007060656>";
const NewItemPing = "<@1370426338007060656>";
const NewGamePing = "<@1370426338007060656>";
*/

const PingCount = 5;

const ConsecutiveNot200 = 4;
const RefreshTime = 4;

const VortexUptimeChannelId = "1555632959464284292";
const NewLimitedChannelId = "1555631510881833080";
const NewItemChannelId = "1555651204103798894";
const NewGamesChannelId = "1555655850587332781";

let LimitedItems = [];
let Items = [];
let Games = [];

let DowntimePingTime = 0;
let UptimePingTime = 0;
let UptimeCount = 0;
let VortexDown = false;
let CheckingVortex = false;

const Client = new ClientClass({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

function IsLimited(Item) {
  return (
    Item.limited === true ||
    Item.limited === 1 ||
    Item.limited === "1" ||
    Item.limited === "true"
  );
}

async function SendUptimeMessage(Channel, Response) {
  await Channel.send(
    `${UptimePing} [Vortex](https://playvortex.io) is UP\nStatus: ${Response.status} ${Response.statusText}`,
  );
}

async function SendDowntimeMessage(Channel, Response) {
  await Channel.send(
    `${DowntimePing} [Vortex](https://playvortex.io) is DOWN\nStatus: ${Response.status} ${Response.statusText}`,
  );
}

async function SendItemMessage(NewLimitedChannel, NewItemChannel, Item) {
  const Limited = IsLimited(Item);
  const Channel = Limited ? NewLimitedChannel : NewItemChannel;
  const Ping = Limited ? NewLimitedPing : NewItemPing;

  await Channel.send(
    `${Ping} New${Limited ? " Limited " : " "}item: ${Item.name}\nhttps://playvortex.io/catalog/${Item.id}`,
  );
}

async function SendGameMessage(Channel, Game) {
  await Channel.send(
    `${NewGamePing} New game: ${Game.name}\nhttps://playvortex.io/games/${Game.id}`,
  );
}

async function HandleVortexUp(Channel, Response) {
  if (!VortexDown) {
    return;
  }

  UptimeCount++;

  console.log(`[Ktb] Uptime check: ${UptimeCount}/${ConsecutiveNot200}`);

  if (UptimeCount < ConsecutiveNot200) {
    return;
  }

  if (UptimePingTime < PingCount) {
    UptimePingTime++;

    await SendUptimeMessage(Channel, Response);

    console.log(`[Ktb] Uptime ping: ${UptimePingTime}/${PingCount}`);

    return;
  }

  UptimeCount = 0;
  UptimePingTime = 0;
  VortexDown = false;

  console.log("[Ktb] Vortex is UP");
}

async function HandleVortexDown(Channel, Response) {
  if (VortexDown) {
    return;
  }

  UptimeCount = 0;
  UptimePingTime = 0;
  VortexDown = true;

  await SendDowntimeMessage(Channel, Response);

  console.log("[Ktb] Vortex is DOWN");
}

async function HandleVortexRequestFailure(Channel, Error) {
  if (VortexDown) {
    return;
  }

  DowntimePingTime++;

  console.log(`[Ktb] Downtime check: ${DowntimePingTime}/${ConsecutiveNot200}`);

  if (DowntimePingTime < ConsecutiveNot200) {
    return;
  }

  UptimeCount = 0;
  UptimePingTime = 0;
  DowntimePingTime = 0;
  VortexDown = true;

  await Channel.send(
    `${DowntimePing} [Vortex](https://playvortex.io) is DOWN\nRequest failed: ${Error.message}`,
  );

  console.log("[Ktb] Vortex is DOWN");
}

async function HandleItems(NewLimitedChannel, NewItemChannel, CatalogData) {
  if (!Array.isArray(CatalogData.items)) {
    console.log("[Ktb] Catalog did not contain a valid items array");
    return;
  }

  for (const Item of CatalogData.items) {
    const ItemId = String(Item.id);
    const Limited = IsLimited(Item);

    const IsKnownItem = Items.includes(ItemId);
    const WasLimited = LimitedItems.includes(ItemId);

    if (IsKnownItem) {
      if (Limited && !WasLimited) {
        console.log(`[Ktb] Item became limited: ${Item.name} (${Item.id})`);

        for (let PingTime = 0; PingTime < PingCount; PingTime++) {
          await SendItemMessage(NewLimitedChannel, NewItemChannel, Item);
        }

        LimitedItems.push(ItemId);
      }

      continue;
    }

    if (Limited) {
      console.log(`[Ktb] New limited item: ${Item.name} (${Item.id})`);

      for (let PingTime = 0; PingTime < PingCount; PingTime++) {
        await SendItemMessage(NewLimitedChannel, NewItemChannel, Item);
      }

      LimitedItems.push(ItemId);
    } else {
      console.log(`[Ktb] New item: ${Item.name} (${Item.id})`);

      await SendItemMessage(NewLimitedChannel, NewItemChannel, Item);
    }

    Items.push(ItemId);
  }
}

async function HandleGames(Channel, GamesData) {
  if (!Array.isArray(GamesData)) {
    console.log("[Ktb] Games response was not an array");
    return;
  }

  for (const Game of GamesData) {
    const GameId = String(Game.id);

    if (Games.includes(GameId)) {
      continue;
    }

    console.log(`[Ktb] New game: ${Game.name} (${Game.id})`);

    await SendGameMessage(Channel, Game);

    Games.push(GameId);
  }
}

async function CheckVortex(
  VortexUptimeChannel,
  NewLimitedChannel,
  NewItemChannel,
  NewGamesChannel,
) {
  if (CheckingVortex) {
    console.log("[Ktb] Previous check is still running");
    return;
  }

  CheckingVortex = true;

  try {
    const SessionToken = process.env.VORTEX_TOKEN;

    const CatalogResponse = await fetch(
      "https://playvortex.io/api/catalog/init",
      {
        headers: {
          Cookie: `session_token=${SessionToken}`,
        },
      },
    );

    console.log(`[Ktb] Vortex status: ${CatalogResponse.status}`);

    if (CatalogResponse.status != 200) {
      await HandleVortexDown(VortexUptimeChannel, CatalogResponse);

      return;
    }

    await HandleVortexUp(VortexUptimeChannel, CatalogResponse);

    const CatalogData = await CatalogResponse.json();

    console.log(
      `[Ktb] Catalog items: ${
        Array.isArray(CatalogData.items) ? CatalogData.items.length : 0
      }`,
    );

    await HandleItems(NewLimitedChannel, NewItemChannel, CatalogData);

    const GamesResponse = await fetch("https://playvortex.io/api/games", {
      headers: {
        Cookie: `session_token=${SessionToken}`,
      },
    });

    console.log(`[Ktb] Games status: ${GamesResponse.status}`);

    if (GamesResponse.status != 200) {
      await HandleVortexDown(VortexUptimeChannel, GamesResponse);

      return;
    }

    const GamesData = await GamesResponse.json();

    console.log(
      `[Ktb] Games: ${Array.isArray(GamesData) ? GamesData.length : 0}`,
    );

    await HandleGames(NewGamesChannel, GamesData);
  } catch (Error) {
    console.log(`[Ktb] Vortex request failed: ${Error.message}`);

    await HandleVortexRequestFailure(VortexUptimeChannel, Error);
  } finally {
    CheckingVortex = false;
  }
}

Client.once("clientReady", async () => {
  console.log(`[Ktb] Logged in as ${Client.user.tag}`);

  try {
    const VortexUptimeChannel = await Client.channels.fetch(
      VortexUptimeChannelId,
    );

    const NewLimitedChannel = await Client.channels.fetch(NewLimitedChannelId);

    const NewItemChannel = await Client.channels.fetch(NewItemChannelId);

    const NewGamesChannel = await Client.channels.fetch(NewGamesChannelId);

    const SessionToken = process.env.VORTEX_TOKEN;

    const CatalogResponse = await fetch(
      "https://playvortex.io/api/catalog/init",
      {
        headers: {
          Cookie: `session_token=${SessionToken}`,
        },
      },
    );

    console.log(`[Ktb] Initial catalog status: ${CatalogResponse.status}`);

    if (CatalogResponse.status == 200) {
      const CatalogData = await CatalogResponse.json();

      if (Array.isArray(CatalogData.items)) {
        for (const Item of CatalogData.items) {
          const ItemId = String(Item.id);

          if (!Items.includes(ItemId)) {
            Items.push(ItemId);
          }

          if (IsLimited(Item) && !LimitedItems.includes(ItemId)) {
            LimitedItems.push(ItemId);
          }
        }
      }

      console.log(`[Ktb] Initial items: ${Items.length}`);

      console.log(`[Ktb] Initial limited items: ${LimitedItems.length}`);
    } else {
      await HandleVortexDown(VortexUptimeChannel, CatalogResponse);
    }

    const GamesResponse = await fetch("https://playvortex.io/api/games", {
      headers: {
        Cookie: `session_token=${SessionToken}`,
      },
    });

    console.log(`[Ktb] Initial games status: ${GamesResponse.status}`);

    if (GamesResponse.status == 200) {
      const GamesData = await GamesResponse.json();

      if (Array.isArray(GamesData)) {
        for (const Game of GamesData) {
          const GameId = String(Game.id);

          if (!Games.includes(GameId)) {
            Games.push(GameId);
          }
        }
      }

      console.log(`[Ktb] Initial games: ${Games.length}`);
    } else {
      await HandleVortexDown(VortexUptimeChannel, GamesResponse);
    }

    setInterval(async () => {
      await CheckVortex(
        VortexUptimeChannel,
        NewLimitedChannel,
        NewItemChannel,
        NewGamesChannel,
      );
    }, RefreshTime * 1000);
  } catch (Error) {
    console.log(`[Ktb] Startup failed: ${Error.message}`);
  }
});

Client.login(process.env.DISCORD_TOKEN);
