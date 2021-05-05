// I know, it's a monolith down here - will get this improved and evolved soon 🙂

const TelegramBot = require("node-telegram-bot-api");
const fetch = require("node-fetch");
const fs = require("fs");

const botToken = process.env.TOKEN;
const bot = new TelegramBot(botToken, { polling: true });
const logger = console;
const usedQueue = {};

const API_FETCH_FROM_URL = `${process.env.API}?robot=1`;
const DIFF_MIN = 10; // TODO: Iterate on top of this if necessary
const TIMER_BOT_FETCH = 1000;
const _guichefferId = 93074192;

const links = {
  arena: "https://bit.ly/2PL4I8J",
  tempelhof: "https://bit.ly/2PONurc",
  messe: "https://bit.ly/3b0xCJr",
  velodrom: "https://bit.ly/3thD8h7",
  tegel: "https://bit.ly/3eeAIeT",
  erika: "https://bit.ly/2QIki5J",
};

const readTelegramIds = () => JSON.parse(fs.readFileSync("./ids.json"));

const checkFirstAvailableDate = (dates, dateKeys, placeName) => {
  for (let i = 0; i < dateKeys.length; i++) {
    const today = new Date();
    const currentDate = dates[dateKeys[i]];
    const lastTime = new Date(currentDate.last);
    const diffMs = lastTime - today;
    const diffDays = Math.floor(diffMs / 86400000) * -1;
    const diffHrs = Math.floor((diffMs % 86400000) / 3600000) * -1;
    const diffMins = Math.round(((diffMs % 86400000) % 3600000) / 60000) * -1;

    if (diffDays !== 1) continue;
    if (diffHrs !== 1) continue;

    logger.info(
      `🔥 Closest: ${dateKeys[i]} for ${diffMins} minutes at ${placeName} - (${diffMins} <> ${DIFF_MIN})`
    );

    if (diffMins <= DIFF_MIN) {
      if (usedQueue[dateKeys[i]]?.toString() === lastTime.toString()) return;

      usedQueue[dateKeys[i]] = lastTime;
      return { availableDate: dateKeys[i], diffMins };
    }
  }
};

// Interval for checking vaccines appointment
setInterval(() => {
  let msgsQueue = [];

  fetch(API_FETCH_FROM_URL, {
    body: null,
    credentials: "omit",
    method: "GET",
    mode: "cors",
  })
    .then((res) => res.json())
    .then((json) => {
      const { stats: places } = json;

      logger.info("🔥 Fetching from ", new Date());
      const telegramIds = JSON.parse(fs.readFileSync("./ids.json"));

      for (let i = 0; i < places.length; i++) {
        const dates = places[i].stats ?? {};
        const dateKeys = Object.keys(dates);
        const hasDates = Boolean(dateKeys.length);
        const place = places[i].id;
        const placeName = places[i].name;

        if (!hasDates) continue;

        const { availableDate = null, diffMins } =
          checkFirstAvailableDate(dates, dateKeys, placeName) ?? {};

        if (availableDate) {
          const link = links[place];
          const date = new Date(availableDate).toLocaleDateString("pt-BR");

          msgsQueue.push(
            `💉 Appointments on _${placeName}_ available on *${date}* at ${link} (_seen ${diffMins} mins ago_)`
          );
        }
      }

      // Send actual messages to users
      msgsQueue.forEach((msg) => {
        telegramIds.forEach((telegramId) =>
          bot.sendMessage(telegramId, msg, {
            disable_web_page_preview: true,
            parse_mode: "Markdown",
          })
        );
      });
    });
}, TIMER_BOT_FETCH);

bot.on("message", (msg) => {
  const givenChatId = msg.chat.id;
  const text = msg.text;
  console.info(msg.chat);

  if (text === "/start") {
    bot.sendMessage(givenChatId, "👋🏼 Please run `/join` to join us! ❤️", {
      parse_mode: "Markdown",
    });
  } else if (text === "/join") {
    const telegramIds = readTelegramIds();
    if (telegramIds.includes(givenChatId))
      return bot.sendMessage(
        givenChatId,
        "❌ You are already part of the team. 😘"
      );
    const data = JSON.stringify([...telegramIds, givenChatId]);

    fs.writeFileSync("./ids.json", data, ({ message }) => {
      if (message) {
        logger.error(
          "❌ There has been an error saving your configuration data." + message
        );
        return;
      }
    });

    bot.sendMessage(
      givenChatId,
      "👋🏼 Welcome to the team. Just wait for new updates now."
    );
  } else if (text === "/help") {
    const telegramIds = readTelegramIds();
    if (telegramIds.includes(givenChatId))
      return bot.sendMessage(
        givenChatId,
        "❌ You are already part of the team, just sit back and wait for new upcoming, hopefully, available appointments seen in less than 10 minutes. 😘"
      );

    bot.sendMessage(
      givenChatId,
      "👋🏼 Run `/join` in order to join on the queue for fetching available vaccine appointments."
    );
  } else if (givenChatId === _guichefferId && text.includes("/broadcast")) {
    const telegramIds = readTelegramIds();
    const message = text.replace("/broadcast ", "📣 ");

    logger.log(`📣 Broadcasting: "${text}"`);

    telegramIds.forEach((telegramId) => {
      bot.sendMessage(telegramId, message, { parse_mode: "Markdown" });
    });
  } else {
    bot.sendMessage(givenChatId, "❌ Stop talking shit to me! 🖕🏼");
  }

  // Send message to @guicheffer
  bot.sendMessage(
    _guichefferId,
    `📣 Someone talking to your bot (${givenChatId} - ${msg.chat?.first_name} (${msg.chat?.username})): ${text}`
  );
});
