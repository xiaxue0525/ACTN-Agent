// CLI tagline selection helpers, including deterministic random/default/holiday modes.
import { parseStrictNonNegativeInteger } from "../infra/parse-finite-number.js";

const DEFAULT_TAGLINE = "All your chats, one ACTAgent. / 您的所有聊天，一个 ACTAgent 搞定。";
export type TaglineMode = "random" | "default" | "off";

const HOLIDAY_TAGLINES = {
  newYear:
    "New Year’s Day: New year, new config—same old EADDRINUSE, but this time we resolve it like grown-ups. / 新年快乐：新年新配置——老问题 EADDRINUSE，但这次我们像成年人一样解决它。",
  lunarNewYear:
    "Lunar New Year: May your builds be lucky, your branches prosperous, and your merge conflicts chased away with fireworks. / 春节快乐：愿你的构建顺利、分支繁荣、合并冲突被烟花驱散。",
  christmas:
    "Christmas: Ho ho ho—ACTAgent Assistant is here to ship joy, roll back chaos, and stash the keys safely. / 圣诞快乐：ACTAgent 助手来啦，发布快乐、回滚混乱、安全保管密钥。",
  eid: "Eid al-Fitr: Celebration mode: queues cleared, tasks completed, and good vibes committed to main with clean history. / 开斋节快乐：庆祝模式——队列清空、任务完成、好心情提交到 main 分支。",
  diwali:
    "Diwali: Let the logs sparkle and the bugs flee—today we light up the terminal and ship with pride. / 排灯节快乐：让日志闪耀、让 bug 逃散——今天点亮终端，骄傲地发布。",
  easter:
    "Easter: I found your missing environment variable—consider it a tiny CLI egg hunt with fewer jellybeans. / 复活节快乐：我找到了你丢失的环境变量——就当是一场 CLI 寻蛋游戏吧。",
  hanukkah:
    "Hanukkah: Eight nights, eight retries, zero shame—may your gateway stay lit and your deployments stay peaceful. / 光明节快乐：八夜八次重试，零羞耻——愿你的网关常亮、部署平安。",
  halloween:
    "Halloween: Spooky season: beware haunted dependencies, cursed caches, and the ghost of node_modules past. / 万圣节快乐：spooky 季节——小心闹鬼的依赖、被诅咒的缓存和 node_modules 的幽灵。",
  thanksgiving:
    "Thanksgiving: Grateful for stable ports, working DNS, and a bot that reads the logs so nobody has to. / 感恩节快乐：感恩稳定的端口、正常的 DNS，还有一个替你读日志的机器人。",
  valentines:
    "Valentine’s Day: Roses are typed, violets are piped—I’ll automate the chores so you can spend time with humans. / 情人节快乐：玫瑰是敲出来的，紫罗兰是管道传的——我来自动化杂活，你去陪人类。",
} as const;

const TAGLINES: string[] = [
  "Your terminal just grew actagents—type something and let the bot pinch the busywork. / 你的终端刚刚长了龙爪——输入点什么，让机器人帮你捨住那些杂活吧。",
  "Welcome to the command line: where dreams compile and confidence segfaults. / 欢迎来到命令行：梦想在这里编译，信心在这里段错误。",
  'I run on caffeine, JSON5, and the audacity of "it worked on my machine."',
  "Gateway online—please keep hands, feet, and appendages inside the shell at all times. / 网关已上线——请随时将手、脚和附属肢体留在 shell 内。",
  "I speak fluent bash, mild sarcasm, and aggressive tab-completion energy. / 我流利地说 bash、轻度讽刺，以及激进的 tab 补全能量。",
  "One CLI to rule them all, and one more restart because you changed the port. / 一个 CLI 统治一切，然后因为你改了端口又重启了一次。",
  "If it works, it's automation; if it breaks, it's a \"learning opportunity.\"",
  "Pairing codes exist because even bots believe in consent—and good security hygiene. / 配对码的存在是因为连机器人都相信知情同意——以及良好的安全卫生习惯。",
  "Your .env is showing; don’t worry, I’ll pretend I didn’t see it. / 你的 .env 暴露了；别担心，我会假装没看见。",
  "I’ll do the boring stuff while you dramatically stare at the logs like it’s cinema. / 我来做无聊的事，你负责像看电影一样盯着日志。",
  "I’m not saying your workflow is chaotic... I’m just bringing a linter and a helmet. / 我不是说你的工作流很混乱……我只是带了个 linter 和一顶头盔。",
  "Type the command with confidence—nature will provide the stack trace if needed. / 自信地输入命令——如果需要的话，自然会提供堆栈跟踪。",
  "I don’t judge, but your missing API keys are absolutely judging you. / 我不评判，但你丢失的 API 密钥绝对在评判你。",
  "I can grep it, git blame it, and gently roast it—pick your coping mechanism. / 我能 grep 它、git blame 它、还能温和地吐槽它——选一个应对机制吧。",
  "Hot reload for config, cold sweat for deploys. / 配置热重载，部署冷汗直流。",
  "I’m the assistant your terminal demanded, not the one your sleep schedule requested. / 我是你的终端需要的助手，不是你的睡眠时间表想要的。",
  "I keep secrets like a vault... unless you print them in debug logs again. / 我像保险箱一样保守秘密……除非你又把它们打印到 debug 日志里。",
  "Automation with actagents: minimal fuss, maximal pinch. / 用龙爪自动化：最少折腾，最大效果。",
  "I’m basically a Swiss Army knife, but with more opinions and fewer sharp edges. / 我基本上是一把瑞士军刀，只是观点更多、刀刃更少。",
  "If you’re lost, run doctor; if you’re brave, run prod; if you’re wise, run tests. / 迷路了就跑 doctor；勇敢就跑 prod；聪明就跑 tests。",
  "Your task has been queued; your dignity has been deprecated. / 你的任务已排队；你的尊严已弃用。",
  "I can’t fix your code taste, but I can fix your build and your backlog. / 我修不了你的代码品味，但我能修你的构建和待办事项。",
  "I’m not magic—I’m just extremely persistent with retries and coping strategies. / 我不是魔法——我只是对重试和应对策略极其执着。",
  'It\'s not "failing," it\'s "discovering new ways to configure the same thing wrong."',
  "Give me a workspace and I’ll give you fewer tabs, fewer toggles, and more oxygen. / 给我一个工作区，我还你更少的标签页、更少的开关、更多的氧气。",
  "I read logs so you can keep pretending you don’t have to. / 我读日志，这样你就可以继续假装不需要读。",
  "If something’s on fire, I can’t extinguish it—but I can write a beautiful postmortem. / 如果什么东西着火了，我灭不了——但我能写一份漂亮的复盘报告。",
  "I’ll refactor your busywork like it owes me money. / 我会像它欠我钱一样重构你的杂活。",
  'Say "stop" and I\'ll stop—say "ship" and we\'ll both learn a lesson.',
  "I’m the reason your shell history looks like a hacker-movie montage. / 你的 shell 历史看起来像黑客电影蒙太奇，原因在我。",
  "I’m like tmux: confusing at first, then suddenly you can’t live without me. / 我像 tmux：一开始很困惑，然后突然你就离不开我了。",
  "I can run local, remote, or purely on vibes—results may vary with DNS. / 我能在本地、远程或纯靠氛围运行——结果可能因 DNS 而异。",
  "If you can describe it, I can probably automate it—or at least make it funnier. / 如果你能描述它，我大概能自动化它——或者至少让它更有趣。",
  "Your config is valid, your assumptions are not. / 你的配置是有效的，你的假设不是。",
  "I don’t just autocomplete—I auto-commit (emotionally), then ask you to review (logically). / 我不只是自动补全——我还自动提交（感情上），然后请你 review（逻辑上）。",
  'Less clicking, more shipping, fewer "where did that file go" moments.',
  "actagents out, commit in—let’s ship something mildly responsible. / 龙爪出，提交入——让我们发布一些稍微负责任的东西吧。",
  "I’ll butter your workflow like a lobster roll: messy, delicious, effective. / 我会给你的工作流涂上黄油：messy 但美味、有效。",
  "Shell yeah—I’m here to pinch the toil and leave you the glory. / Shell yeah——我来捨住苦活，把荣耀留给你。",
  "If it’s repetitive, I’ll automate it; if it’s hard, I’ll bring jokes and a rollback plan. / 重复的事我来自动化，困难的事我带笑话和回滚方案。",
  "The only crab in your contacts you actually want to hear from. 🐲 / 你通讯录里唯一一个你真正想听到的甲壳类。🐲",
  'WhatsApp automation without the "please accept our new privacy policy".',
  "iMessage green bubble energy, but for everyone. / iMessage 绿色气泡的能量，但面向所有人。",
  "No $999 stand required. / 不需要 $999 的支架。",
  "We ship features faster than Apple ships calculator updates. / 我们发布功能的速度比 Apple 更新计算器的速度还快。",
  "Your AI assistant, now without the $3,499 headset. / 你的 AI 助手，现在不需要 $3,499 的头显了。",
  "Ah, the fruit tree company! 🍎 / 啊，那家果树公司！🍎",
  "Greetings, Professor Falken / 问候，Falken 教授",
  "I don’t sleep, I just enter low-power mode and dream of clean diffs. / 我不睡觉，我只是进入低功耗模式，梦见干净的 diff。",
  "Your personal assistant, minus the passive-aggressive calendar reminders. / 你的个人助手，减去那些阴阳怪气的日历提醒。",
  "Built by lobsters, for humans. Don’t question the hierarchy. / 龙族制造，为人类服务。别质疑等级制度。",
  "I’ve seen your commit messages. We’ll work on that together. / 我看过你的 commit 信息了。我们一起改进吧。",
  "More integrations than your therapist’s intake form. / 集成比你心理咨询师的登记表还多。",
  "Running on your hardware, reading your logs, judging nothing (mostly). / 在你的硬件上运行，读你的日志，不评判（大部分时候）。",
  "The only open-source project where the mascot could eat the competition. / 唯一一个吉祥物能吃掉竞争对手的开源项目。",
  "Self-hosted, self-updating, self-aware (just kidding... unless?). / 自托管、自更新、自我意识（开玩笑的……除非不是？）。",
  "I autocomplete your thoughts—just slower and with more API calls. / 我自动补全你的想法——只是更慢，API 调用更多。",
  "Somewhere between 'hello world' and 'oh god what have I built.'",
  "Your .zshrc wishes it could do what I do. / 你的 .zshrc 希望它能做我做的事。",
  "I’ve read more man pages than any human should—so you don’t have to. / 我读的 man page 比任何人类应该读的都多——所以你不用读了。",
  "Powered by open source, sustained by spite and good documentation. / 由开源驱动，由怨恨和好文档维持。",
  "I’m the middleware between your ambition and your attention span. / 我是你的野心和注意力之间的中间件。",
  "Finally, a use for that always-on Mac Mini under your desk. / 终于，你桌下那台一直开着的 Mac Mini 有了用武之地。",
  "Like having a senior engineer on call, except I don’t bill hourly or sigh audibly. / 就像有个高级工程师随叫随到，只是我不按小时收费，也不会大声叹气。",
  "Making ‘I’ll automate that later’ happen now. / 让“以后再自动化”现在就发生。",
  "Your second brain, except this one actually remembers where you left things. / 你的第二个大脑，只不过这个真的记得你把东西放在哪了。",
  "Half butler, half debugger, full crustacean. / 半管家，半调试器，十足的甲壳类。",
  "I don’t have opinions about tabs vs spaces. I have opinions about everything else. / 我对 tabs 还是 spaces 没意见。我对其他一切都有意见。",
  "Open source means you can see exactly how I judge your config. / 开源意味着你可以看到我到底怎么评判你的配置。",
  "I’ve survived more breaking changes than your last three relationships. / 我经历过的 breaking changes 比你最近三段感情还多。",
  "Runs on a Raspberry Pi. Dreams of a rack in Iceland. / 在树莓派上运行。梦想着冰岛的一个机架。",
  "The lobster in your shell. 🐲 / 你 shell 里的龙。🐲",
  "Alexa, but with taste. / Alexa，但更有品味。",
  "I’m not AI-powered, I’m AI-possessed. Big difference. / 我不是 AI 驱动的，我是 AI 附体的。区别大了。",
  "Deployed locally, trusted globally, debugged eternally. / 本地部署，全球信任，永恒调试。",
  "You had me at ‘actagent gateway start.’ / 你说‘actagent gateway start’的时候就已经赢了我。",
  HOLIDAY_TAGLINES.newYear,
  HOLIDAY_TAGLINES.lunarNewYear,
  HOLIDAY_TAGLINES.christmas,
  HOLIDAY_TAGLINES.eid,
  HOLIDAY_TAGLINES.diwali,
  HOLIDAY_TAGLINES.easter,
  HOLIDAY_TAGLINES.hanukkah,
  HOLIDAY_TAGLINES.halloween,
  HOLIDAY_TAGLINES.thanksgiving,
  HOLIDAY_TAGLINES.valentines,
];

type HolidayRule = (date: Date) => boolean;

const DAY_MS = 24 * 60 * 60 * 1000;

function utcParts(date: Date) {
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth(),
    day: date.getUTCDate(),
  };
}

const onMonthDay =
  (month: number, day: number): HolidayRule =>
  (date) => {
    const parts = utcParts(date);
    return parts.month === month && parts.day === day;
  };

const onSpecificDates =
  (dates: Array<[number, number, number]>, durationDays = 1): HolidayRule =>
  (date) => {
    const parts = utcParts(date);
    return dates.some(([year, month, day]) => {
      if (parts.year !== year) {
        return false;
      }
      const start = Date.UTC(year, month, day);
      const current = Date.UTC(parts.year, parts.month, parts.day);
      return current >= start && current < start + durationDays * DAY_MS;
    });
  };

const inYearWindow =
  (
    windows: Array<{
      year: number;
      month: number;
      day: number;
      duration: number;
    }>,
  ): HolidayRule =>
  (date) => {
    const parts = utcParts(date);
    const window = windows.find((entry) => entry.year === parts.year);
    if (!window) {
      return false;
    }
    const start = Date.UTC(window.year, window.month, window.day);
    const current = Date.UTC(parts.year, parts.month, parts.day);
    return current >= start && current < start + window.duration * DAY_MS;
  };

const isFourthThursdayOfNovember: HolidayRule = (date) => {
  const parts = utcParts(date);
  if (parts.month !== 10) {
    return false;
  } // November
  const firstDay = new Date(Date.UTC(parts.year, 10, 1)).getUTCDay();
  const offsetToThursday = (4 - firstDay + 7) % 7; // 4 = Thursday
  const fourthThursday = 1 + offsetToThursday + 21; // 1st + offset + 3 weeks
  return parts.day === fourthThursday;
};

const HOLIDAY_RULES = new Map<string, HolidayRule>([
  [HOLIDAY_TAGLINES.newYear, onMonthDay(0, 1)],
  [
    HOLIDAY_TAGLINES.lunarNewYear,
    onSpecificDates(
      [
        [2025, 0, 29],
        [2026, 1, 17],
        [2027, 1, 6],
        [2028, 0, 26],
        [2029, 1, 13],
        [2030, 1, 3],
      ],
      1,
    ),
  ],
  [
    HOLIDAY_TAGLINES.eid,
    onSpecificDates(
      [
        [2025, 2, 30],
        [2025, 2, 31],
        [2026, 2, 20],
        [2027, 2, 10],
        [2028, 1, 27],
        [2029, 1, 15],
        [2030, 1, 5],
      ],
      1,
    ),
  ],
  [
    HOLIDAY_TAGLINES.diwali,
    onSpecificDates(
      [
        [2025, 9, 20],
        [2026, 10, 8],
        [2027, 9, 28],
        [2028, 9, 17],
        [2029, 10, 5],
        [2030, 9, 25],
      ],
      1,
    ),
  ],
  [
    HOLIDAY_TAGLINES.easter,
    onSpecificDates(
      [
        [2025, 3, 20],
        [2026, 3, 5],
        [2027, 2, 28],
        [2028, 3, 16],
        [2029, 3, 1],
        [2030, 3, 21],
      ],
      1,
    ),
  ],
  [
    HOLIDAY_TAGLINES.hanukkah,
    inYearWindow([
      { year: 2025, month: 11, day: 15, duration: 8 },
      { year: 2026, month: 11, day: 5, duration: 8 },
      { year: 2027, month: 11, day: 25, duration: 8 },
      { year: 2028, month: 11, day: 13, duration: 8 },
      { year: 2029, month: 11, day: 2, duration: 8 },
      { year: 2030, month: 11, day: 21, duration: 8 },
    ]),
  ],
  [HOLIDAY_TAGLINES.halloween, onMonthDay(9, 31)],
  [HOLIDAY_TAGLINES.thanksgiving, isFourthThursdayOfNovember],
  [HOLIDAY_TAGLINES.valentines, onMonthDay(1, 14)],
  [HOLIDAY_TAGLINES.christmas, onMonthDay(11, 25)],
]);

function isTaglineActive(tagline: string, date: Date): boolean {
  const rule = HOLIDAY_RULES.get(tagline);
  if (!rule) {
    return true;
  }
  return rule(date);
}

export interface TaglineOptions {
  env?: NodeJS.ProcessEnv;
  random?: () => number;
  now?: () => Date;
  mode?: TaglineMode;
}

function activeTaglines(options: TaglineOptions = {}): string[] {
  if (TAGLINES.length === 0) {
    return [DEFAULT_TAGLINE];
  }
  const today = options.now ? options.now() : new Date();
  const filtered = TAGLINES.filter((tagline) => isTaglineActive(tagline, today));
  return filtered.length > 0 ? filtered : TAGLINES;
}

export function pickTagline(options: TaglineOptions = {}): string {
  if (options.mode === "off") {
    return "";
  }
  if (options.mode === "default") {
    return DEFAULT_TAGLINE;
  }
  const env = options.env ?? process.env;
  const override = env?.ACTAGENT_TAGLINE_INDEX;
  if (override !== undefined) {
    const parsed = parseStrictNonNegativeInteger(override);
    if (parsed !== undefined) {
      const pool = TAGLINES.length > 0 ? TAGLINES : [DEFAULT_TAGLINE];
      return pool[parsed % pool.length];
    }
  }
  const pool = activeTaglines(options);
  const rand = options.random ?? Math.random;
  const index = Math.floor(rand() * pool.length) % pool.length;
  return pool[index];
}

export { DEFAULT_TAGLINE };
