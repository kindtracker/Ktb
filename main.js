const { Client: ClientClass, GatewayIntentBits } = require("discord.js");

let Mode = "Limited"; // "Uptime" "Limited"
let Ping = "@everyone";
let ConsecutiveNot500 = 3;
let RefreshTime = 5;

let LimitedItems = [244, 243, 340, 251, 43];

let UptimeCount = 0;

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

Client.once("clientReady", async () => {
  console.log(`[Ktb] Logged in as ${Client.user.tag}`);
  const Channel = await Client.channels.fetch("1554665497331503206");

  setInterval(async () => {
    if (Mode == "Limited") {
      const Response = await fetch("https://playvortex.io/api/catalog/init", {
        headers: {
          Cookie: "session_token=" + process.env.VORTEX_TOKEN,
        },
      });
      console.log(`[Ktb] Vortex status: ${Response.status}`);
      const CatalogData = await Response.json();
      console.log(`[Ktb] Catalog items: ${CatalogData.items.length}`);

      for (const Item of CatalogData.items) {
        if (Item.limited == true && !LimitedItems.includes(Item.id)) {
          console.log(`[Ktb] New limited item: ${Item.name} (${Item.id})`);
          await Channel.send(
            `${Ping} New limited item: ${Item.name}\nhttps://playvortex.io/catalog/${Item.id}`,
          );
        }
      }
    } else if (Mode == "Uptime") {
      const Response = await fetch("https://playvortex.io/me", {
        headers: {
          Cookie: "session_token=" + process.env.VORTEX_TOKEN,
        },
      });

      console.log(`[Ktb] Vortex status: ${Response.status}`);
      if (Response.status == 200) {
        UptimeCount++;

        console.log(`[Ktb] Uptime check: ${UptimeCount}/${ConsecutiveNot500}`);

        if (UptimeCount >= ConsecutiveNot500) {
          await Channel.send(
            `${Ping} Vortex is UP\nStatus: ${Response.status}`,
          );
          UptimeCount = 0;
        }
      } else {
        UptimeCount = 0;
      }
    }
  }, RefreshTime * 1000);
});

Client.login(process.env.DISCORD_TOKEN);
