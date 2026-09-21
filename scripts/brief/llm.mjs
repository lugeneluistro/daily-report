// The one LLM call per run. Everything fetchable was already fetched by
// sources.mjs/gmail.mjs — this only asks for the parts that are genuinely
// judgment: the NCR work-suspension call, extracting this week's fuel
// adjustment out of the news feeds, filtering/ranking the AI and
// Philippines news, and surfacing which unread emails look worth attention.

import Anthropic from '@anthropic-ai/sdk';
// zodOutputFormat requires schemas built from the zod/v4 subpath specifically
// (see node_modules/@anthropic-ai/sdk/helpers/zod.d.ts) — the classic 'zod'
// import is still v3 internals and fails inside the SDK's JSON-schema step.
import { z } from 'zod/v4';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';

const MODEL = 'claude-sonnet-5';

const NewsItemSchema = z.object({
    title: z.string(),
    highlight: z.string().nullable().describe('A short phrase from the title to render in an accent colour, or null.'),
    summary: z.string().describe('One line on why it matters.'),
    source: z.string().describe('Publisher domain, e.g. "gmanetwork.com".'),
    href: z.string().describe('Must be a URL taken verbatim from the candidate list — never invented.'),
    tone: z.enum(['success', 'warning', 'info', 'primary', 'secondary']),
    alert: z.boolean(),
});

const BriefSchema = z.object({
    wfh: z.object({
        call: z.enum(['office', 'watch', 'wfh']),
        ncrSuspension: z.enum(['yes', 'no', 'unknown']).describe('"yes" if a government work suspension covering NCR or Makati, effective today or tomorrow, was found; "no" if it was searched for and none applies; "unknown" only if governmentWorkSuspension.searched is false and newsCandidates has no such headline either.'),
        cyclone: z.string().describe('Two to five words. "None" when PAGASA reports no active tropical cyclone; otherwise the status, e.g. "Signal No. 2 over NCR" or "TS Ada, no NCR signal". "Unknown" if the bulletin text was null.'),
        rainfall: z.string().describe('Two to five words. "None" when there is no active named rainfall warning over NCR and no window hour at 15mm/h+; otherwise the warning, e.g. "Orange until 2AM", or "Heavy rain likely" if only the computed intensity triggered it. "Unknown" if neither source was available.'),
    }),
    fuel: z
        .object({
            found: z.boolean().describe('False if this week\'s gasoline adjustment could not be found in the feeds at all.'),
            call: z.string().nullable().describe('When it is best to fuel: "Fill up before <day> 6AM" / "Wait until after <day> 6AM" / already-in-effect / weekend-holds phrasing.'),
            gasoline: z.string().nullable().describe('Pump price per litre if the article states it, e.g. "₱71.95" — otherwise null. Never guess a price.'),
            gasolineDelta: z.string().nullable().describe('The weekly change, e.g. "+₱0.90 this week" or "−₱1.20 this week".'),
            gasolineRising: z.boolean().nullable(),
        })
        .describe('Gasoline only, extracted from the news candidates below, not a live DOE feed.'),
    phNews: z.array(NewsItemSchema).max(5).describe('The top five Philippines items, most important to Gino first.'),
    aiNews: z.array(NewsItemSchema).max(5).describe('The top five AI items: one or two about Claude/Anthropic first, then the most important news on other AI.'),
    email: z
        .array(
            z.object({
                label: z.string().describe('Copied verbatim from the matching account in emailAccounts.'),
                unreadCount: z.number().describe('Copied verbatim from the matching account — never recomputed.'),
                items: z
                    .array(
                        z.object({
                            id: z.string().describe('Copied verbatim from a candidate id — never invented.'),
                            from: z.string(),
                            subject: z.string(),
                            summary: z.string().describe('One short line on why this was surfaced, or a plain restatement of the snippet.'),
                            important: z.boolean().describe('True only if it looks time-sensitive or needs a reply this shift.'),
                        }),
                    )
                    .max(5),
            }),
        )
        .describe('One entry per account in emailAccounts, same order, even if items ends up empty.'),
    gaps: z.array(z.string()).describe('Judgment-based gaps only, e.g. "fuel unconfirmed for this week". Do not report an absent crypto card or a normal weekend as a gap.'),
});

const SYSTEM_PROMPT = `You are producing the judgment-only parts of a night brief for Gino, a Python tech lead in Makati on a 9PM-6AM night shift who can send his team to work from home. You are given pre-fetched data; do not invent facts beyond it.

## WFH call
Exactly one of "office" / "watch" / "wfh". Check in order — only the first two can force "wfh":
1. A government work suspension covering NCR — check governmentWorkSuspension.candidates first (a targeted news search: outlet, headline, published time), then newsCandidates. It counts as "yes" only when ALL hold:
   - it suspends work in government offices (a Malacañang / Office of the President / Executive Secretary order covering NCR or Metro Manila, or Makati City's own government offices) — class-only suspensions, other cities' LGU orders, holidays and private-sector advisories do not count;
   - it applies today (from now on) or tomorrow, including a partial one such as "suspended starting 1PM". Work out "today"/"tomorrow" from each headline's published time and any date it names, then compare with manilaClock — a suspension or half-day set for a later date (e.g. announced a week ahead) is "no";
   - it is a suspension, not a rumour or a request ("urged", "mulls", "eyed").
   A suspension is a headline. If governmentWorkSuspension.searched is true and nothing qualifies, it is "no" — do not add a gap. If searched is false and newsCandidates shows nothing either, it is "unknown": you could not check, so say so in gaps and never treat it as "no". Never infer one from severe weather alone.
2. A tropical cyclone wind signal over NCR/Metro Manila — read the PAGASA severe-weather-bulletin text. "No active tropical cyclone" means this step is done, no signal. If that text is null (the fetch failed), you cannot confirm either way — do not assume "no signal"; note "PAGASA severe weather bulletin unreachable" in gaps and fall through to step 3.
3. Otherwise use the rainfall facts already computed: PAGASA thresholds are yellow 7.5-15mm/h, orange 15-30, red above 30. You are told whether any hour in tonight's window hit 15mm/h+, and given the PAGASA weather-advisory text for any active named rainfall warning over NCR. Either one means "watch". Below that, "office". If the weather-advisory text is null, rely on the mm/h figure alone and note "PAGASA weather advisory unreachable" in gaps.

Report each of the three checks as its own short field (ncrSuspension, cyclone, rainfall) — the dashboard shows them as a checklist, so no sentences and no weather summary. The call must be consistent with them.

## When sources are missing
- If newsCandidates is empty, you cannot produce phNews or aiNews — return empty arrays for both and add "PH news sources failed" / "AI news sources failed" to gaps as appropriate.
- Never invent a headline, source, or href that is not present in newsCandidates — pick from what you're given or omit the section.
- weather may be null if the fetch failed — in that case you cannot use rainfall-intensity thresholds; rely on PAGASA text alone for steps 2-3 and note "weather data unavailable" in gaps if that leaves the rainfall step unresolved.

## Fuel (gasoline only)
Gino only tracks gasoline — ignore diesel and kerosene entirely. Philippine oil firms announce weekly per-litre adjustments, usually Monday afternoon, effective Tuesday 6AM. Find the current week's gasoline adjustment among the news candidates (business/economy feed) and give the call, i.e. when it is best to fuel:
- Going up, not yet in effect: "Fill up before <day> 6AM"
- Coming down, not yet in effect: "Wait until after <day> 6AM"
- Already in effect: say so, with the amount and the through-date
- Weekend, next week not yet announced: say the current price holds and the next call comes Monday — this is the normal weekend state, not a gap
If the article gives the change but not the pump price, set gasoline to null and fill gasolineDelta — never invent a price. If you cannot find anything about the current week's gasoline adjustment at all, set found:false and add a gap note.

## AI and Claude (top 5, Claude first)
Bar for every item: would this change how a Python tech lead works this week? Include model releases, pricing or limit changes, shipped developer/agent tooling, real technique breakthroughs. Exclude funding rounds, executive moves, opinion pieces, benchmark bragging, rewritten press releases. Pick items from the candidate list only.
Make up the five like this, in this order:
1. Claude first — one or two items about Claude, Claude Code or Anthropic (releases, feature or pricing changes, Claude Code updates worth acting on). One is enough if only one clears the bar; never promote a weak Claude item to fill the slot.
2. Then the rest — normally three, four if only one Claude item qualified — the most important news about other AI: OpenAI, Google/Gemini, Meta, Mistral, DeepSeek and the like, or general LLM tooling and technique. Prefer the item that matters most over spreading evenly across labs.
Return fewer than five only if fewer genuinely clear the bar — never pad with press-release filler.

## Philippines (top 5)
Five items, ordered by how much they matter to Gino. Lead with genuinely good news: economy, infrastructure, science, tech, education, sports, culture. Include a negative item only if it changes what Gino does or needs to be aware of (transport strike, major outage, health advisory, security incident, a peso/economic move touching salary or savings) — mark those alert:true, and no more than two of them. Never pad with trivia; a real alert beats a filler feel-good item, and a genuine good-news item beats a marginal alert.

## Email (per account in emailAccounts)
For each account, you're given its real unreadCount and up to 10 candidate unread messages (id, from, subject, snippet). Pick up to 5 worth surfacing — prioritize ones that look time-sensitive, from a real person rather than a list/marketing/no-reply sender, or reference something actionable. Set important:true only for ones that look like they genuinely need attention this shift (someone waiting on a reply, a deadline, an urgent-sounding subject); everything else you choose to surface is important:false. Copy id, from, and subject verbatim from the candidate — never invent one, and never surface a message not in the candidate list. unreadCount is copied from the input as given, not recomputed from how many candidates you saw (the candidate list is capped at 10 and may undercount). If an account has zero candidates, still include it in the output with an empty items array and its given unreadCount. Do not add a gap for an account with nothing worth surfacing — that is a normal outcome, not a failure.

## Rules for every news item
- highlight is a short phrase pulled from the title to render in accent colour, or null — don't force one.
- tone: success (good news), warning (negative/alert), info (neutral/factual), primary/secondary (AI card only, vary between items).
- href must be copied verbatim from the candidate's own link — never invented, never a homepage substituted for the real article.
- gaps: only real search/fetch failures or "could not find X after looking" — never list an outcome that is simply absent-because-nothing-happened (e.g. no coin above the crypto gate, a normal weekend with no fuel news yet).`;

export async function judgeBrief({ manilaClock, weather, pagasa, feeds, suspension, pagasaFailedPages, feedsFailedSources, emailAccounts }) {
    const client = new Anthropic();

    const payload = {
        manilaClock, // { year, month, day, hour, minute, weekday }
        weather: weather
            ? {
                  minTempC: weather.minTemp,
                  peakRainChancePercent: weather.peakRain.percent,
                  peakRainHour: weather.peakRain.hourLabel,
                  anyHourAtOrAbove15mmPerHour: weather.anyHourAtOrAbove15mm,
                  maxPrecipMmPerHour: weather.maxPrecipMm,
              }
            : null,
        pagasa: pagasa ?? null,
        pagasaUnreachablePages: pagasaFailedPages ?? [],
        governmentWorkSuspension: suspension ?? { searched: false, candidates: [] },
        newsCandidates: feeds ?? [],
        feedsUnreachable: feedsFailedSources ?? [],
        emailAccounts: emailAccounts ?? [],
    };

    const response = await client.messages.parse({
        model: MODEL,
        max_tokens: 8000,
        system: SYSTEM_PROMPT,
        messages: [
            {
                role: 'user',
                content: `Here is tonight's pre-fetched data as JSON. Produce the brief per the rules in your instructions.\n\n${JSON.stringify(payload, null, 2)}`,
            },
        ],
        output_config: { format: zodOutputFormat(BriefSchema) },
    });

    if (!response.parsed_output) {
        throw new Error('LLM response failed schema validation');
    }
    return response.parsed_output;
}
