const TelegramBot = require("node-telegram-bot-api");
const fetch = require("node-fetch");

const botToken = process.env.TOKEN;
const today = new Date();
const bot = new TelegramBot(botToken, { polling: true });
const logger = console;

const FETCH_VERSION = 0.2;
const FETCH_FROM_URL = `${process.env.API}?v=${FETCH_VERSION}`;
const INTERVAL_IN_MINUTES = 0.1; // 6 seconds
const TIMER_BOT_FETCH = INTERVAL_IN_MINUTES * 1000 * 60;
const _guichefferId = 93074192;
const telegramIds = [
  _guichefferId,
  // 167893598,
];

const links = {
  arena: "https://bit.ly/2PL4I8J",
  tempelhof: "https://bit.ly/2PONurc",
  messe: "https://bit.ly/3b0xCJr",
  velodrom: "https://bit.ly/3thD8h7",
  tegel: "https://bit.ly/3eeAIeT",
  erika: "https://bit.ly/2QIki5J",
};

const checkFirstAvailableDate = (dates, dateKeys, placeName) => {
  for (let i = 0; i < dateKeys.length; i++) {
    const currentDate = dates[dateKeys[i]];
    const lastTime = new Date(currentDate.last);
    const diffMs = lastTime - today;
    const diffDays = Math.floor(diffMs / 86400000) * -1;
    const diffHrs = Math.floor((diffMs % 86400000) / 3600000) * -1;
    const diffMins = Math.round(((diffMs % 86400000) % 3600000) / 60000) * -1;

    if (diffDays !== 1) continue;
    if (diffHrs !== 1) continue;

    logger.info(
      `📸 Closest: ${dateKeys[i]} for ${diffMins} minutes at ${placeName}`
    );

    if (diffMins <= INTERVAL_IN_MINUTES + 1) return dateKeys[i];
  }
};

// Interval for checking vaccines appointment
setInterval(() => {
  let msgsQueue = [];

  fetch(FETCH_FROM_URL, {
    body: null,
    credentials: "omit",
    method: "GET",
    mode: "cors",
    referrer: "https://impfstoff.link/",
    referrerPolicy: "strict-origin-when-cross-origin",
  })
    .then((res) => res.json())
    .then((json) => {
      const { stats: places } = json;

      logger.info("🔥 Fetching from ", new Date());

      // TODO: Remove it
      bot.sendMessage(_guichefferId, "🔥 Fetching from " + new Date());

      for (let i = 0; i < places.length; i++) {
        const dates = places[i].stats ?? {};
        const dateKeys = Object.keys(dates);
        const hasDates = Boolean(dateKeys.length);
        const place = places[i].id;
        const placeName = places[i].name;

        if (!hasDates) continue;

        const availableDate = checkFirstAvailableDate(
          dates,
          dateKeys,
          placeName
        );

        if (availableDate) {
          const link = links[place];
          const date = new Date(availableDate).toLocaleDateString("pt-BR");

          msgsQueue.push(
            `💉 Appointments on _${placeName}_ available at *${date}* on ${link}`
          );
        }
      }

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

  bot.sendMessage(givenChatId, "Stop talking shit to me! 🖕🏼");

  // Send message to @guicheffer
  bot.sendMessage(
    _guichefferId,
    `📣 Someone talking to your bot (${givenChatId} - ${
      msg.chat?.first_name + " " + msg.chat?.last_name
    }): ` + text
  );
});
