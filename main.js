const { Client: ClientClass, GatewayIntentBits } = require("discord.js");

/*
const NewItemPing = "<@&1555656321813061794>";
const NewGamePing = "<@&1555656524884611112>";
const NewLimitedPing = "<@&1555634098372870195>";
const UptimePing = "<@&1555634154354515968>";
const DowntimePing = "<@&1555645752586412062>";
*/

const NewLimitedPing = "<@1370426338007060656>";
const UptimePing = "<@1370426338007060656>";
const DowntimePing = "<@1370426338007060656>";
const NewItemPing = "<@1370426338007060656>";
const NewGamePing = "<@1370426338007060656>";

const PingCount = 5;

const ConsecutiveNot500 = 4;
const RefreshTime = 3;

const VortexUptimeChannelId = "1555632959464284292";
const NewLimitedChannelId = "1555631510881833080";
const NewItemChannelId = "1555651204103798894";
const NewGamesChannelId = "1555655850587332781";

let LimitedItems = [];
let Items = [];
let Games = [];

let UptimePingTime = 0;
let UptimeCount = 0;
let VortexDown = false;

const Client = new ClientClass({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

async function SendUptimeMessage(Channel, Response) {
  await Channel.send(
    `${UptimePing} [Vortex](https://playvortex.io) is UP\nStatus: ${Response.status} ${Response.statusMessage}`,
  );
}

async function SendDowntimeMessage(Channel, Response) {
  await Channel.send(
    `${DowntimePing} [Vortex](https://playvortex.io) is DOWN\nStatus: ${Response.status} ${Response.statusMessage}`,
  );
}

async function SendItemMessage(NewLimitedChannel, NewItemChannel, Item) {
  await (Item.limited ? NewLimitedChannel : NewItemChannel).send(
    `${Item.limited ? NewLimitedPing : NewItemPing} New${Item.limited ? " Limited " : " "}item: ${Item.name}\nhttps://playvortex.io/catalog/${Item.id}`,
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

  console.log(`[Ktb] Uptime check: ${UptimeCount}/${ConsecutiveNot500}`);

  if (UptimeCount < ConsecutiveNot500) {
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

async function HandleItems(NewLimitedChannel, NewItemChannel, CatalogData) {
  for (const Item of CatalogData.items) {
    const ItemId = String(Item.id);

    if (Items.includes(ItemId)) {
      continue;
    }

    if (Item.limited == true) {
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
  try {
    const CatalogResponse = await fetch(
      "https://playvortex.io/api/catalog/init",
      {
        headers: {
          Cookie: "session_token=" + process.env.VORTEX_TOKEN,
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
    console.log(`[Ktb] Catalog items: ${CatalogData.items.length}`);

    await HandleItems(NewLimitedChannel, NewItemChannel, CatalogData);

    const GamesResponse = await fetch("https://playvortex.io/api/games", {
      headers: {
        Cookie: "session_token=" + process.env.VORTEX_TOKEN,
      },
    });

    if (GamesResponse.status != 200) {
      await HandleVortexDown(VortexUptimeChannel, GamesResponse);
      return;
    }

    const GamesData = await GamesResponse.json();
    console.log(`[Ktb] Games: ${GamesData.length}`);

    await HandleGames(NewGamesChannel, GamesData);
  } catch (Error) {
    UptimeCount = 0;

    console.log(`[Ktb] Vortex request failed: ${Error.message}`);

    if (!VortexDown) {
      VortexDown = true;
      UptimePingTime = 0;

      await VortexUptimeChannel.send(
        `${DowntimePing} [Vortex](https://playvortex.io) is DOWN\nRequest failed: ${Error.message}`,
      );

      console.log(`[Ktb] Vortex is DOWN`);
    }
  }
}

Client.once("clientReady", async () => {
  console.log(`[Ktb] Logged in as ${Client.user.tag}`);

  const VortexUptimeChannel = await Client.channels.fetch(
    VortexUptimeChannelId,
  );

  const NewLimitedChannel = await Client.channels.fetch(NewLimitedChannelId);

  const NewItemChannel = await Client.channels.fetch(NewItemChannelId);

  const NewGamesChannel = await Client.channels.fetch(NewGamesChannelId);

  const CatalogResponse = await fetch(
    "https://playvortex.io/api/catalog/init",
    {
      headers: {
        Cookie: "session_token=" + process.env.VORTEX_TOKEN,
      },
    },
  );

  if (CatalogResponse.status == 200) {
    const CatalogData = await CatalogResponse.json();

    for (const Item of CatalogData.items) {
      const ItemId = String(Item.id);

      Items.push(ItemId);

      if (Item.limited) {
        LimitedItems.push(ItemId);
      }
    }
  } else {
    await HandleVortexDown(VortexUptimeChannel, CatalogResponse);
  }

  const GamesResponse = await fetch("https://playvortex.io/api/games", {
    headers: {
      Cookie: "session_token=" + process.env.VORTEX_TOKEN,
    },
  });

  if (GamesResponse.status == 200) {
    const GamesData = await GamesResponse.json();

    for (const Game of GamesData) {
      Games.push(String(Game.id));
    }
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
});

Client.login(process.env.DISCORD_TOKEN);
