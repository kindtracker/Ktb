const { Client: ClientClass, GatewayIntentBits } = require("discord.js");

/*
const NewLimitedPing = "@everyone";
const UptimePing = "@everyone";
const DowntimePing = "@everyone";
*/

const NewLimitedPing = "<@1370426338007060656>";
const UptimePing = "<@1370426338007060656>";
const DowntimePing = "<@1370426338007060656>";

const PingCount = 5;

const ConsecutiveNot500 = 4;
const RefreshTime = 3;

const VortexUptimeChannelId = "1555632959464284292";
const NewLimitedChannelId = "1555631510881833080";
const NewItemChannelId = "1555651204103798894";

let LimitedItems = [];
let Items = [];

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
    `${NewLimitedPing} New${Item.limited ? " Limited " : " "}item: ${Item.name}\nhttps://playvortex.io/catalog/${Item.id}`,
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

async function CheckVortex(
  VortexUptimeChannel,
  NewLimitedChannel,
  NewItemChannel,
) {
  try {
    const Response = await fetch("https://playvortex.io/api/catalog/init", {
      headers: {
        Cookie: "session_token=" + process.env.VORTEX_TOKEN,
      },
    });

    console.log(`[Ktb] Vortex status: ${Response.status}`);

    if (Response.status != 200) {
      await HandleVortexDown(VortexUptimeChannel, Response);
      return;
    }

    await HandleVortexUp(VortexUptimeChannel, Response);

    const CatalogData = await Response.json();
    console.log(`[Ktb] Catalog items: ${CatalogData.items.length}`);

    await HandleItems(NewLimitedChannel, NewItemChannel, CatalogData);
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

  const Response = await fetch("https://playvortex.io/api/catalog/init", {
    headers: {
      Cookie: "session_token=" + process.env.VORTEX_TOKEN,
    },
  });

  if (Response.status == 200) {
    const CatalogData = await Response.json();

    for (const Item of CatalogData.items) {
      const ItemId = String(Item.id);

      Items.push(ItemId);

      if (Item.limited) {
        LimitedItems.push(ItemId);
      }
    }
  } else {
    await HandleVortexDown(VortexUptimeChannel, Response);
  }

  setInterval(async () => {
    await CheckVortex(VortexUptimeChannel, NewLimitedChannel, NewItemChannel);
  }, RefreshTime * 1000);
});

Client.login(process.env.DISCORD_TOKEN);
