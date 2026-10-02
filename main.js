const { Client: ClientClass, GatewayIntentBits } = require("discord.js");

const NewLimitedPing = "@everyone";
const UptimePing = "@everyone";
const DowntimePing = "@everyone";
const PingCount = 5;

const ConsecutiveNot500 = 4;
const RefreshTime = 3;

const VortexUptimeChannelId = "1555632959464284292";
const NewLimitedChannelId = "1555631510881833080";

let LimitedItems = [244, 243, 340, 251, 43];

let UptimePingTime = 0;
let DowntimePingTime = 0;
let UptimeCount = 0;
let VortexDown = false;

const Client = new ClientClass({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

function Wait(Milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, Milliseconds));
}

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

async function SendLimitedMessage(Channel, Item) {
  await Channel.send(
    `${NewLimitedPing} New limited item: ${Item.name}\nhttps://playvortex.io/catalog/${Item.id}`,
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
  DowntimePingTime = 0;
  VortexDown = false;

  console.log("[Ktb] Vortex is UP");
}

async function HandleVortexDown(Channel, Response) {
  if (!VortexDown) {
    DowntimePingTime = 0;
    UptimeCount = 0;
    UptimePingTime = 0;
  }

  if (DowntimePingTime < PingCount) {
    DowntimePingTime++;

    await SendDowntimeMessage(Channel, Response);

    console.log(`[Ktb] Downtime ping: ${DowntimePingTime}/${PingCount}`);

    VortexDown = true;

    return;
  }

  VortexDown = true;

  console.log("[Ktb] Vortex is DOWN");
}

async function HandleLimitedItems(Channel, CatalogData) {
  for (const Item of CatalogData.items) {
    if (Item.limited == true && !LimitedItems.includes(Item.id)) {
      console.log(`[Ktb] New limited item: ${Item.name} (${Item.id})`);

      for (let PingTime = 0; PingTime < PingCount; PingTime++) {
        await SendLimitedMessage(Channel, Item);
      }

      LimitedItems.push(Item.id);
    }
  }
}

async function CheckVortex(VortexUptimeChannel, NewLimitedChannel) {
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

    await HandleLimitedItems(NewLimitedChannel, CatalogData);
  } catch (Error) {
    UptimeCount = 0;

    console.log(`[Ktb] Vortex request failed: ${Error.message}`);

    if (!VortexDown) {
      DowntimePingTime = 0;
      UptimePingTime = 0;
      console.log(`[Ktb] Vortex is DOWN`);
    }

    if (DowntimePingTime < PingCount) {
      DowntimePingTime++;

      await VortexUptimeChannel.send(
        `${DowntimePing} [Vortex](https://playvortex.io) is DOWN\nRequest failed: ${Error.message}`,
      );
    }

    VortexDown = true;
  }
}

Client.once("clientReady", async () => {
  console.log(`[Ktb] Logged in as ${Client.user.tag}`);

  const VortexUptimeChannel = await Client.channels.fetch(
    VortexUptimeChannelId,
  );

  const NewLimitedChannel = await Client.channels.fetch(NewLimitedChannelId);

  setInterval(async () => {
    await CheckVortex(VortexUptimeChannel, NewLimitedChannel);
  }, RefreshTime * 1000);
});

Client.login(process.env.DISCORD_TOKEN);
